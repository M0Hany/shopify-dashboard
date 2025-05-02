import express from 'express';

const router = express.Router();

// Get all orders with optional filters
router.get('/', async (req, res) => {
  try {
    // Return test data
    const testOrders = [
      {
        id: 1,
        name: "#1001",
        created_at: new Date().toISOString(),
        customer: {
          first_name: "John",
          last_name: "Doe",
          phone: "1234567890"
        },
        shipping_address: {
          address1: "123 Test St",
          address2: "Apt 4B",
          city: "Cairo",
          province: "Cairo",
          zip: "12345",
          country: "Egypt"
        },
        total_price: "1500.00",
        financial_status: "paid",
        fulfillment_status: "unfulfilled",
        tags: ["express", "custom_due_date:2024-03-20"],
        line_items: [
          {
            title: "Crochet Blanket",
            quantity: 2,
            price: "750.00",
            variant_title: "Large/Blue"
          }
        ]
      }
    ];
    res.json(testOrders);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single order by ID
router.get('/:id', async (req, res) => {
  res.json({
    id: Number(req.params.id),
    name: `#${1000 + Number(req.params.id)}`,
    created_at: new Date().toISOString(),
    customer: {
      first_name: "John",
      last_name: "Doe",
      phone: "1234567890"
    },
    shipping_address: {
      address1: "123 Test St",
      address2: "Apt 4B",
      city: "Cairo",
      province: "Cairo",
      zip: "12345",
      country: "Egypt"
    },
    total_price: "1500.00",
    financial_status: "paid",
    fulfillment_status: "unfulfilled",
    tags: ["express", "custom_due_date:2024-03-20"],
    line_items: [
      {
        title: "Crochet Blanket",
        quantity: 2,
        price: "750.00",
        variant_title: "Large/Blue"
      }
    ]
  });
});

// Update order status
router.put('/:id/status', async (req, res) => {
  res.json({ success: true });
});

// Update order due date
router.put('/:id/due-date', async (req, res) => {
  res.json({ success: true });
});

export default router; 