/**
 * Discord Interactions Handler
 * 
 * This endpoint handles Discord button clicks and modal submissions for WhatsApp notifications.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Discord Bot Application at https://discord.com/developers/applications
 * 2. Get your bot's Public Key (found in General Information > Public Key)
 * 3. Set DISCORD_PUBLIC_KEY in your .env file
 * 4. In Discord Developer Portal, go to your bot > Interactions > Interaction Endpoint URL
 * 5. Set the URL to: https://your-domain.com/api/discord/interactions
 * 6. Make sure your bot is added to your Discord server with necessary permissions
 * 
 * NOTE: The "Open Chat" button uses a URL (works without bot setup)
 *       The "Quick Reply" button requires bot setup to handle interactions
 */

import express from 'express';
import { logger } from '../utils/logger';
import { WhatsAppService } from '../services/whatsapp';
import { ShopifyService } from '../services/shopify';
import nacl from 'tweetnacl';
import { format } from 'date-fns';

const router = express.Router();
const whatsappService = new WhatsAppService();
const shopifyService = new ShopifyService();

// Discord public key for signature verification
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

// Log Discord configuration on startup
if (DISCORD_PUBLIC_KEY) {
  logger.info('Discord interactions enabled', {
    publicKeyLength: DISCORD_PUBLIC_KEY.length,
    publicKeyPreview: DISCORD_PUBLIC_KEY.substring(0, 10) + '...' + DISCORD_PUBLIC_KEY.substring(DISCORD_PUBLIC_KEY.length - 10)
  });
} else {
  logger.warn('Discord interactions DISABLED - DISCORD_PUBLIC_KEY not set in environment variables');
}

// Verify Discord interaction signature using Ed25519
function verifySignature(body: string, signature: string, timestamp: string): boolean {
  if (!DISCORD_PUBLIC_KEY) {
    logger.error('Discord public key not configured - signature verification required for Discord interactions');
    return false;
  }

  try {
    // Convert hex strings to Uint8Array
    const message = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, 'hex');
    const publicKey = Buffer.from(DISCORD_PUBLIC_KEY, 'hex');

    // Verify signature using Ed25519
    const isValid = nacl.sign.detached.verify(
      new Uint8Array(message),
      new Uint8Array(sig),
      new Uint8Array(publicKey)
    );

    if (!isValid) {
      logger.warn('Discord signature verification failed', {
        signatureLength: signature.length,
        publicKeyLength: DISCORD_PUBLIC_KEY.length,
        signature: signature.substring(0, 20) + '...',
        publicKey: DISCORD_PUBLIC_KEY.substring(0, 20) + '...'
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying Discord signature', {
      error: error instanceof Error ? error.message : error,
      signatureLength: signature?.length || 0,
      publicKeyLength: DISCORD_PUBLIC_KEY.length,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    return false;
  }
}

// Handle Discord interactions (button clicks, modal submissions)
// IMPORTANT: This route must use express.raw() to get the raw body for signature verification
// The main app's express.json() middleware should NOT process this route
router.post('/interactions', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;

    logger.info('Discord interaction received', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      bodyLength: req.body?.length || 0,
      method: req.method,
      url: req.url,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });

    if (!signature || !timestamp) {
      logger.warn('Missing Discord signature headers', {
        headers: Object.keys(req.headers),
        hasXSignatureEd25519: !!req.headers['x-signature-ed25519'],
        hasXSignatureTimestamp: !!req.headers['x-signature-timestamp'],
        allHeaders: Object.keys(req.headers).filter(h => h.toLowerCase().includes('signature') || h.toLowerCase().includes('discord'))
      });
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    // Get raw body as string for signature verification
    const body = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);

    // Verify signature BEFORE parsing JSON
    if (!verifySignature(body, signature, timestamp)) {
      logger.warn('Discord signature verification failed', {
        bodyPreview: body.substring(0, 100),
        signature: signature.substring(0, 20) + '...',
        timestamp
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse JSON after verification
    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch (parseError) {
      logger.error('Failed to parse Discord interaction body', {
        error: parseError instanceof Error ? parseError.message : parseError,
        bodyPreview: body.substring(0, 200)
      });
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    logger.info('Discord interaction parsed', { 
      type: interaction.type,
      hasData: !!interaction.data,
      customId: interaction.data?.custom_id
    });

    // Handle PING (Discord verification) - MUST respond with type 1
    // This is what Discord uses to verify the endpoint
    if (interaction.type === 1) {
      logger.info('Discord PING received, responding with PONG');
      return res.status(200).json({ type: 1 }); // PONG - this is critical for verification
    }

    // Handle button clicks
    if (interaction.type === 3) { // MESSAGE_COMPONENT
      const { data, message } = interaction;
      const customId = data.custom_id;

      // Extract phone number from custom_id (format: "quick_reply:PHONE" or "open_chat:PHONE")
      if (customId?.startsWith('quick_reply:')) {
        const phone = customId.replace('quick_reply:', '');
        
        // Respond with modal
        return res.json({
          type: 9, // MODAL
          data: {
            title: 'Quick Reply',
            custom_id: `modal_reply:${phone}`,
            components: [
              {
                type: 1, // ACTION_ROW
                components: [
                  {
                    type: 4, // TEXT_INPUT
                    custom_id: 'message',
                    label: 'Message',
                    style: 2, // PARAGRAPH (multi-line)
                    placeholder: 'Type your reply...',
                    required: true,
                    min_length: 1,
                    max_length: 1000
                  }
                ]
              }
            ]
          }
        });
      }

      // Handle "View Order Details" button
      if (customId?.startsWith('view_order:')) {
        const orderNumber = customId.replace('view_order:', '');
        
        try {
          // Fetch order details
          const order = await shopifyService.findOrderByOrderNumber(orderNumber);
          
          if (!order) {
            return res.json({
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                content: `❌ Order ${orderNumber} not found`,
                flags: 64 // EPHEMERAL
              }
            });
          }

          // Format order details for Discord embed
          const tags = Array.isArray(order.tags) 
            ? order.tags 
            : typeof order.tags === 'string'
              ? order.tags.split(',').map((t: string) => t.trim())
              : [];

          // Get status from tags
          const getStatus = () => {
            const trimmedTags = tags.map((t: string) => t.trim().toLowerCase());
            if (trimmedTags.includes('cancelled')) return 'Cancelled';
            if (trimmedTags.includes('fulfilled')) return 'Fulfilled';
            if (trimmedTags.includes('shipped')) return 'Shipped';
            if (trimmedTags.includes('ready_to_ship')) return 'Ready to Ship';
            if (trimmedTags.includes('customer_confirmed')) return 'Confirmed';
            if (trimmedTags.includes('order_ready')) return 'Order Ready';
            return 'Pending';
          };

          // Format line items
          const formatLineItems = (items: any[]) => {
            if (!items || items.length === 0) return 'No items';
            return items.slice(0, 10).map((item: any, idx: number) => {
              const variant = item.variant_title ? ` (${item.variant_title})` : '';
              return `${idx + 1}. ${item.title}${variant} × ${item.quantity}`;
            }).join('\n') + (items.length > 10 ? `\n... and ${items.length - 10} more items` : '');
          };

          // Format dates
          const formatDate = (dateStr: string) => {
            try {
              return format(new Date(dateStr), 'MMM d, yyyy');
            } catch {
              return dateStr;
            }
          };

          // Calculate days left
          const calculateDaysLeft = () => {
            try {
              const trimmedTags = tags.map((t: string) => t.trim());
              const dueDateTag = trimmedTags.find((t: string) => t.startsWith('custom_due_date:'));
              
              let dueDate: Date;
              if (dueDateTag) {
                const dateStr = dueDateTag.split(':')[1];
                dueDate = new Date(dateStr);
              } else {
                // Calculate from start date + making time
                const startDateTag = trimmedTags.find((t: string) => t.startsWith('custom_start_date:'));
                const startDate = startDateTag 
                  ? new Date(startDateTag.split(':')[1])
                  : new Date(order.created_at);
                
                // Detect making time from line items (3 for rush, 7 for handmade)
                const makingTime = order.line_items?.some((item: any) => 
                  item.title?.toLowerCase().includes('rush') || 
                  item.title?.toLowerCase().includes('3 days')
                ) ? 3 : 7;
                
                dueDate = new Date(startDate);
                dueDate.setDate(dueDate.getDate() + makingTime);
              }
              
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays < 0) return `${diffDays} days (Overdue)`;
              if (diffDays === 0) return 'Today';
              return `${diffDays} days`;
            } catch {
              return 'N/A';
            }
          };

          // Get shipping method
          const getShippingMethod = () => {
            const shippingTag = tags.find((t: string) => 
              t.trim().toLowerCase().startsWith('shipping_method:')
            );
            if (shippingTag) {
              const method = shippingTag.split(':')[1]?.trim();
              if (method === 'scooter') return 'Scooter';
              if (method === 'pickup') return 'Pickup';
              if (method === 'other-company' || method === 'other_company') return 'Other Company';
            }
            return 'Shipblu';
          };

          // Get priority status
          const isPriority = tags.some((t: string) => t.trim().toLowerCase() === 'priority');

          // Get start and due dates
          const getStartDate = () => {
            const startDateTag = tags.find((t: string) => t.trim().startsWith('custom_start_date:'));
            if (startDateTag) {
              return formatDate(startDateTag.split(':')[1]);
            }
            return formatDate(order.created_at);
          };

          const getDueDate = () => {
            const dueDateTag = tags.find((t: string) => t.trim().startsWith('custom_due_date:'));
            if (dueDateTag) {
              return formatDate(dueDateTag.split(':')[1]);
            }
            return 'Calculated from start date';
          };

          // Build embed with order details
          const embed = {
            title: `📦 Order ${order.name}${isPriority ? ' ⭐' : ''}`,
            color: 0x5865F2, // Discord blurple
            fields: [
              {
                name: 'Customer',
                value: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'N/A',
                inline: true
              },
              {
                name: 'Phone',
                value: order.customer?.phone || order.shipping_address?.phone || 'N/A',
                inline: true
              },
              {
                name: 'Status',
                value: getStatus(),
                inline: true
              },
              {
                name: 'Total Price',
                value: `$${order.total_price}`,
                inline: true
              },
              {
                name: 'Days Left',
                value: calculateDaysLeft(),
                inline: true
              },
              {
                name: 'Shipping Method',
                value: getShippingMethod(),
                inline: true
              },
              {
                name: 'Start Date',
                value: getStartDate(),
                inline: true
              },
              {
                name: 'Due Date',
                value: getDueDate(),
                inline: true
              },
              {
                name: 'Created',
                value: formatDate(order.created_at),
                inline: true
              },
              {
                name: 'Items',
                value: formatLineItems(order.line_items || []),
                inline: false
              }
            ],
            timestamp: new Date().toISOString()
          };

          // Add shipping address if available
          if (order.shipping_address) {
            const address = [
              order.shipping_address.address1,
              order.shipping_address.address2,
              order.shipping_address.city,
              order.shipping_address.province,
              order.shipping_address.zip,
              order.shipping_address.country
            ].filter(Boolean).join(', ');

            if (address) {
              embed.fields.push({
                name: 'Shipping Address',
                value: address.length > 1024 ? address.substring(0, 1020) + '...' : address,
                inline: false
              });
            }
          }

          // Add tags if available
          if (tags.length > 0) {
            const tagsStr = tags.slice(0, 20).join(', ');
            embed.fields.push({
              name: 'Tags',
              value: tagsStr.length > 1024 ? tagsStr.substring(0, 1020) + '...' : tagsStr,
              inline: false
            });
          }

          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              embeds: [embed],
              flags: 64 // EPHEMERAL - only visible to user who clicked
            }
          });
        } catch (error) {
          logger.error('Error fetching order details', {
            error,
            orderNumber
          });

          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: `❌ Failed to fetch order details: ${error instanceof Error ? error.message : 'Unknown error'}`,
              flags: 64 // EPHEMERAL
            }
          });
        }
      }

      // Handle "View Order by Phone" button (fallback when order number not available)
      if (customId?.startsWith('view_order_by_phone:')) {
        const phone = customId.replace('view_order_by_phone:', '');
        
        try {
          // Find orders by phone
          const orders = await shopifyService.getOrdersByPhone(phone);
          
          if (!orders || orders.length === 0) {
            return res.json({
              type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
              data: {
                content: `❌ No orders found for phone number`,
                flags: 64 // EPHEMERAL
              }
            });
          }

          // Get the most recent order
          const order = orders[0];

          // Format order details (same as above)
          const tags = Array.isArray(order.tags) 
            ? order.tags 
            : typeof order.tags === 'string'
              ? order.tags.split(',').map((t: string) => t.trim())
              : [];

          const getStatus = () => {
            const trimmedTags = tags.map((t: string) => t.trim().toLowerCase());
            if (trimmedTags.includes('cancelled')) return 'Cancelled';
            if (trimmedTags.includes('fulfilled')) return 'Fulfilled';
            if (trimmedTags.includes('shipped')) return 'Shipped';
            if (trimmedTags.includes('ready_to_ship')) return 'Ready to Ship';
            if (trimmedTags.includes('customer_confirmed')) return 'Confirmed';
            if (trimmedTags.includes('order_ready')) return 'Order Ready';
            return 'Pending';
          };

          const formatLineItems = (items: any[]) => {
            if (!items || items.length === 0) return 'No items';
            return items.slice(0, 10).map((item: any, idx: number) => {
              const variant = item.variant_title ? ` (${item.variant_title})` : '';
              return `${idx + 1}. ${item.title}${variant} × ${item.quantity}`;
            }).join('\n') + (items.length > 10 ? `\n... and ${items.length - 10} more items` : '');
          };

          const formatDate = (dateStr: string) => {
            try {
              return format(new Date(dateStr), 'MMM d, yyyy');
            } catch {
              return dateStr;
            }
          };

          const calculateDaysLeft = () => {
            try {
              const trimmedTags = tags.map((t: string) => t.trim());
              const dueDateTag = trimmedTags.find((t: string) => t.startsWith('custom_due_date:'));
              
              let dueDate: Date;
              if (dueDateTag) {
                const dateStr = dueDateTag.split(':')[1];
                dueDate = new Date(dateStr);
              } else {
                const startDateTag = trimmedTags.find((t: string) => t.startsWith('custom_start_date:'));
                const startDate = startDateTag 
                  ? new Date(startDateTag.split(':')[1])
                  : new Date(order.created_at);
                
                const makingTime = order.line_items?.some((item: any) => 
                  item.title?.toLowerCase().includes('rush') || 
                  item.title?.toLowerCase().includes('3 days')
                ) ? 3 : 7;
                
                dueDate = new Date(startDate);
                dueDate.setDate(dueDate.getDate() + makingTime);
              }
              
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays < 0) return `${diffDays} days (Overdue)`;
              if (diffDays === 0) return 'Today';
              return `${diffDays} days`;
            } catch {
              return 'N/A';
            }
          };

          const getShippingMethod = () => {
            const shippingTag = tags.find((t: string) => 
              t.trim().toLowerCase().startsWith('shipping_method:')
            );
            if (shippingTag) {
              const method = shippingTag.split(':')[1]?.trim();
              if (method === 'scooter') return 'Scooter';
              if (method === 'pickup') return 'Pickup';
              if (method === 'other-company' || method === 'other_company') return 'Other Company';
            }
            return 'Shipblu';
          };

          const isPriority = tags.some((t: string) => t.trim().toLowerCase() === 'priority');

          const getStartDate = () => {
            const startDateTag = tags.find((t: string) => t.trim().startsWith('custom_start_date:'));
            if (startDateTag) {
              return formatDate(startDateTag.split(':')[1]);
            }
            return formatDate(order.created_at);
          };

          const getDueDate = () => {
            const dueDateTag = tags.find((t: string) => t.trim().startsWith('custom_due_date:'));
            if (dueDateTag) {
              return formatDate(dueDateTag.split(':')[1]);
            }
            return 'Calculated from start date';
          };

          const embed = {
            title: `📦 Order ${order.name}${isPriority ? ' ⭐' : ''}`,
            color: 0x5865F2,
            fields: [
              {
                name: 'Customer',
                value: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'N/A',
                inline: true
              },
              {
                name: 'Phone',
                value: order.customer?.phone || order.shipping_address?.phone || 'N/A',
                inline: true
              },
              {
                name: 'Status',
                value: getStatus(),
                inline: true
              },
              {
                name: 'Total Price',
                value: `$${order.total_price}`,
                inline: true
              },
              {
                name: 'Days Left',
                value: calculateDaysLeft(),
                inline: true
              },
              {
                name: 'Shipping Method',
                value: getShippingMethod(),
                inline: true
              },
              {
                name: 'Start Date',
                value: getStartDate(),
                inline: true
              },
              {
                name: 'Due Date',
                value: getDueDate(),
                inline: true
              },
              {
                name: 'Created',
                value: formatDate(order.created_at),
                inline: true
              },
              {
                name: 'Items',
                value: formatLineItems(order.line_items || []),
                inline: false
              }
            ],
            timestamp: new Date().toISOString()
          };

          if (order.shipping_address) {
            const address = [
              order.shipping_address.address1,
              order.shipping_address.address2,
              order.shipping_address.city,
              order.shipping_address.province,
              order.shipping_address.zip,
              order.shipping_address.country
            ].filter(Boolean).join(', ');

            if (address) {
              embed.fields.push({
                name: 'Shipping Address',
                value: address.length > 1024 ? address.substring(0, 1020) + '...' : address,
                inline: false
              });
            }
          }

          if (tags.length > 0) {
            const tagsStr = tags.slice(0, 20).join(', ');
            embed.fields.push({
              name: 'Tags',
              value: tagsStr.length > 1024 ? tagsStr.substring(0, 1020) + '...' : tagsStr,
              inline: false
            });
          }

          return res.json({
            type: 4,
            data: {
              embeds: [embed],
              flags: 64
            }
          });
        } catch (error) {
          logger.error('Error fetching order by phone', {
            error,
            phone
          });

          return res.json({
            type: 4,
            data: {
              content: `❌ Failed to fetch order details: ${error instanceof Error ? error.message : 'Unknown error'}`,
              flags: 64
            }
          });
        }
      }
    }

    // Handle modal submissions
    if (interaction.type === 5) { // MODAL_SUBMIT
      const { data, message } = interaction;
      const customId = data.custom_id;

      if (customId?.startsWith('modal_reply:')) {
        const phone = customId.replace('modal_reply:', '');
        const messageText = data.components[0]?.components[0]?.value;

        if (!messageText) {
          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: '❌ Error: Message cannot be empty',
              flags: 64 // EPHEMERAL
            }
          });
        }

        try {
          // Send WhatsApp message
          await whatsappService.sendTextMessage(phone, messageText);

          // Respond with success (ephemeral - only visible to user who clicked)
          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: `✅ Message sent to ${phone}`,
              flags: 64 // EPHEMERAL
            }
          });
        } catch (error) {
          logger.error('Error sending WhatsApp message from Discord', {
            error,
            phone,
            message: messageText
          });

          return res.json({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: `❌ Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
              flags: 64 // EPHEMERAL
            }
          });
        }
      }
    }

    // Unknown interaction type
    return res.status(400).json({ error: 'Unknown interaction type' });
  } catch (error) {
    logger.error('Error handling Discord interaction', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

