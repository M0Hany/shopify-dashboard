"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shopify_1 = require("../services/shopify");
const router = express_1.default.Router();
const shopifyService = new shopify_1.ShopifyService();
// Get all orders with optional filters
router.get('/', async (req, res) => {
    try {
        const orders = await shopifyService.getOrders({
            limit: 250,
            status: req.query.status,
            created_at_min: req.query.created_at_min,
            created_at_max: req.query.created_at_max,
        });
        res.json(orders);
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// Get a single order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await shopifyService.getOrder(Number(req.params.id));
        res.json(order);
    }
    catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
// Update order status
router.put('/:id/status', async (req, res) => {
    try {
        await shopifyService.updateOrderStatus(Number(req.params.id), req.body.status);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});
// Update order due date
router.put('/:id/due-date', async (req, res) => {
    try {
        await shopifyService.updateOrderDueDate(Number(req.params.id), req.body.custom_due_date);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating order due date:', error);
        res.status(500).json({ error: 'Failed to update order due date' });
    }
});
// Update order start date
router.put('/:id/start-date', async (req, res) => {
    try {
        console.log('Received start-date update request:', {
            orderId: req.params.id,
            customStartDate: req.body.custom_start_date,
            body: req.body
        });
        await shopifyService.updateOrderStartDate(Number(req.params.id), req.body.custom_start_date);
        console.log('Start date update successful');
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating order start date:', error);
        res.status(500).json({ error: 'Failed to update order start date' });
    }
});
// Update order note
router.put('/:id/note', async (req, res) => {
    try {
        await shopifyService.updateOrderNote(Number(req.params.id), req.body.note);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating order note:', error);
        res.status(500).json({ error: 'Failed to update order note' });
    }
});
// Update order priority
router.put('/:id/priority', async (req, res) => {
    try {
        await shopifyService.updateOrderPriority(Number(req.params.id), req.body.isPriority);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating order priority:', error);
        res.status(500).json({ error: 'Failed to update order priority' });
    }
});
exports.default = router;
