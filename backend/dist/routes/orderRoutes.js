"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_1 = require("../controllers/orderController");
const router = (0, express_1.Router)();
// Order routes
router.get('/', orderController_1.getOrders);
router.get('/:id', orderController_1.getOrderById);
router.put('/:id/status', orderController_1.updateOrderStatus);
exports.default = router;
