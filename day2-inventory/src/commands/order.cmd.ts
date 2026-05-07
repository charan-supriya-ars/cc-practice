import { Command } from 'commander';
import * as orderService from '../services/order.service.js';

export const orderCommand = new Command('order')
  .description('Manage orders');

orderCommand
  .command('create')
  .description('Create a new order')
  .requiredOption('--customer <name>', 'Customer name')
  .requiredOption('--items <items>', 'Items as JSON: [{"product_id":1,"quantity":2}]')
  .action(async (opts) => {
    const items = JSON.parse(opts.items);
    const order = await orderService.createOrder({
      customer_name: opts.customer,
      items,
    });
    console.log('Order created:', order);
  });

orderCommand
  .command('list')
  .description('List orders')
  .option('--status <status>', 'Filter by status')
  .action(async (opts) => {
    const orders = await orderService.listOrders(opts.status);
    if (orders.length === 0) {
      console.log('No orders found.');
      return;
    }
    console.table(orders);
  });

orderCommand
  .command('get <id>')
  .description('Get order details')
  .action(async (id) => {
    const order = await orderService.getOrderById(Number(id));
    if (!order) {
      console.error(`Order ${id} not found.`);
      process.exitCode = 1;
      return;
    }
    console.log(order);
  });

orderCommand
  .command('status <id> <status>')
  .description('Update order status')
  .action(async (id, status) => {
    const order = await orderService.updateOrderStatus(Number(id), status);
    console.log('Order updated:', order);
  });
