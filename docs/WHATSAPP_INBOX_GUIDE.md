# 📱 WhatsApp Inbox Guide

## Overview

The WhatsApp Inbox is a complete messaging interface built into your Shopify dashboard that allows you to:

- **View all WhatsApp conversations** with customers
- **Send and receive text messages** directly from the dashboard
- **Track message status** (sent, delivered, read, failed)
- **Search conversations** by phone number
- **Mark messages as read** automatically
- **Real-time updates** with automatic refresh

## 🚀 Getting Started

### 1. Access the Inbox

1. Navigate to your dashboard
2. Click on the **"WhatsApp"** tab in the navigation header
3. The inbox will load with all your conversations

### 2. View Conversations

- **Conversations List**: Shows all phone numbers you've messaged with
- **Last Message Preview**: Displays the most recent message from each conversation
- **Unread Count**: Shows the number of unread messages (green badge)
- **Timestamp**: Shows when the last message was sent/received

### 3. Start Messaging

1. **Select a Conversation**: Click on any phone number in the sidebar
2. **View Message History**: All previous messages will load in chronological order
3. **Send a Message**: Type in the input field and press Enter or click the send button
4. **Message Status**: Outgoing messages show delivery status (✓, ✓✓, ✓✓ blue)

## 🔧 Features

### Message Types Supported

- ✅ **Text Messages**: Full text messaging support
- ✅ **Template Messages**: Pre-approved business templates
- ✅ **Button Responses**: Customer button clicks
- ✅ **Status Updates**: Real-time delivery status

### Conversation Management

- **Search**: Filter conversations by phone number
- **Auto-refresh**: Conversations update every 30 seconds
- **Read Status**: Messages are automatically marked as read when opened
- **Message History**: View up to 100 messages per conversation

### Message Status Indicators

- ⏰ **Clock Icon**: Message being sent
- ✓ **Single Check**: Message sent to WhatsApp
- ✓✓ **Double Check**: Message delivered to recipient
- ✓✓ **Blue Check**: Message read by recipient
- ❌ **Red Check**: Message failed to send

## 📊 Message Storage

### Database Integration

All messages are stored in your MongoDB database for:

- **Permanent History**: Never lose message history
- **Fast Retrieval**: Quick conversation loading
- **Search Capability**: Find messages across all conversations
- **Analytics**: Track messaging patterns and statistics

### Message Schema

```typescript
{
  messageId: string;        // WhatsApp message ID
  phone: string;           // Customer phone number
  from: string;           // Sender phone number
  to: string;             // Recipient phone number
  type: string;           // Message type (text, template, etc.)
  text?: { body: string }; // Message content
  timestamp: Date;        // Message timestamp
  status: string;         // Delivery status
  direction: string;      // inbound/outbound
  orderNumber?: string;   // Associated order (if any)
}
```

## 🔄 Real-time Updates

### Automatic Refresh

- **Conversations**: Update every 30 seconds
- **Active Chat**: Update every 10 seconds when conversation is open
- **New Messages**: Automatically appear in real-time
- **Status Updates**: Delivery status updates automatically

### Webhook Integration

The inbox works with your existing WhatsApp webhook to:

- **Capture Incoming Messages**: Store all customer responses
- **Update Message Status**: Track delivery and read receipts
- **Process Button Clicks**: Handle customer confirmations
- **Link to Orders**: Associate messages with order numbers

## 🎯 Use Cases

### Customer Support

1. **Quick Responses**: Reply to customer inquiries instantly
2. **Order Updates**: Send status updates and confirmations
3. **Issue Resolution**: Handle customer complaints and questions
4. **Follow-ups**: Check on customer satisfaction

### Order Management

1. **Order Confirmations**: Send order received confirmations
2. **Production Updates**: Notify when items are ready
3. **Delivery Coordination**: Schedule and confirm deliveries
4. **Payment Reminders**: Send payment confirmations

### Business Communication

1. **Announcements**: Send important updates to customers
2. **Promotions**: Share special offers and discounts
3. **Feedback Collection**: Request customer reviews and feedback
4. **Relationship Building**: Maintain personal customer relationships

## 🛠️ Technical Details

### API Endpoints

```
GET  /api/whatsapp/conversations     # Get all conversations
GET  /api/whatsapp/conversation/:phone # Get conversation history
POST /api/whatsapp/send-text         # Send text message
POST /api/whatsapp/mark-read/:phone  # Mark messages as read
GET  /api/whatsapp/stats             # Get message statistics
```

### Rate Limiting

- **Daily Limit**: 1,000 messages per day
- **Per Recipient**: 250 messages per recipient per day
- **Automatic Tracking**: Built-in rate limit monitoring
- **Error Handling**: Graceful handling of rate limit errors

### Security

- **Phone Number Formatting**: Automatic normalization for Egyptian numbers
- **Message Validation**: Input sanitization and validation
- **Error Logging**: Comprehensive error tracking
- **Access Control**: Secure API endpoints

## 🚨 Troubleshooting

### Common Issues

1. **Messages Not Sending**
   - Check rate limits
   - Verify phone number format
   - Ensure WhatsApp API credentials are valid

2. **Conversations Not Loading**
   - Check database connection
   - Verify webhook is receiving messages
   - Check server logs for errors

3. **Real-time Updates Not Working**
   - Verify webhook URL is accessible
   - Check webhook verification token
   - Ensure webhook is properly configured

### Error Messages

- **"Rate limit exceeded"**: Wait before sending more messages
- **"Failed to send message"**: Check API credentials and phone number
- **"No conversations found"**: No messages have been sent/received yet

## 📈 Best Practices

### Message Management

1. **Quick Responses**: Reply within 24 hours for best customer experience
2. **Clear Communication**: Use simple, clear language
3. **Professional Tone**: Maintain business-appropriate communication
4. **Follow-up**: Check on customer satisfaction after delivery

### Performance

1. **Regular Cleanup**: Archive old conversations periodically
2. **Monitor Usage**: Track message volume and rate limits
3. **Backup Data**: Regular database backups for message history
4. **Update Regularly**: Keep the system updated with latest features

## 🔮 Future Enhancements

### Planned Features

- **File Attachments**: Send images, documents, and media
- **Message Templates**: Quick response templates
- **Bulk Messaging**: Send messages to multiple customers
- **Analytics Dashboard**: Message statistics and insights
- **Integration**: Connect with CRM and other business tools

### Customization

- **Branding**: Customize the interface with your brand colors
- **Notifications**: Email/SMS alerts for new messages
- **Auto-responses**: Automated replies for common questions
- **Workflow Integration**: Connect with order management workflows

---

This WhatsApp Inbox provides a complete messaging solution integrated directly into your Shopify dashboard, making customer communication seamless and efficient. 