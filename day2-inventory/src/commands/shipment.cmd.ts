import { Command } from 'commander';
import * as shipmentService from '../services/shipment.service.js';

export const shipmentCommand = new Command('shipment')
  .description('Manage shipments');

shipmentCommand
  .command('create <order-id>')
  .description('Create a shipment for an order')
  .option('--carrier <carrier>', 'Carrier name', '')
  .option('--tracking <number>', 'Tracking number')
  .action(async (orderId, opts) => {
    const shipment = await shipmentService.createShipment({
      order_id: Number(orderId),
      carrier: opts.carrier,
      tracking_number: opts.tracking,
    });
    console.log('Shipment created:', shipment);
  });

shipmentCommand
  .command('track <order-id>')
  .description('Update shipment tracking info')
  .option('--tracking <number>', 'Tracking number')
  .option('--carrier <carrier>', 'Carrier name')
  .action(async (orderId, opts) => {
    const shipment = await shipmentService.updateShipment(Number(orderId), {
      tracking_number: opts.tracking,
      carrier: opts.carrier,
    });
    console.log('Shipment updated:', shipment);
  });

shipmentCommand
  .command('status <order-id>')
  .description('Get shipment status')
  .action(async (orderId) => {
    const shipment = await shipmentService.getShipmentByOrderId(Number(orderId));
    if (!shipment) {
      console.error(`Shipment for order ${orderId} not found.`);
      process.exitCode = 1;
      return;
    }
    console.log(shipment);
  });

shipmentCommand
  .command('deliver <order-id>')
  .description('Mark shipment as delivered')
  .action(async (orderId) => {
    const shipment = await shipmentService.updateShipment(Number(orderId), {
      status: 'delivered',
    });
    console.log('Shipment delivered:', shipment);
  });
