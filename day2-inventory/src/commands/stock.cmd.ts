import { Command } from 'commander';
import * as stockService from '../services/stock.service.js';

export const stockCommand = new Command('stock')
  .description('Manage stock movements');

stockCommand
  .command('inbound')
  .description('Record an inbound stock movement')
  .requiredOption('--product-id <id>', 'Product ID')
  .requiredOption('--quantity <qty>', 'Quantity')
  .requiredOption('--unit-cost <cost>', 'Unit cost')
  .option('--reason <reason>', 'Reason', 'purchase')
  .option('--notes <notes>', 'Notes', '')
  .action(async (opts) => {
    const movement = await stockService.recordInbound({
      product_id: Number(opts.productId),
      quantity: Number(opts.quantity),
      unit_cost: Number(opts.unitCost),
      reason: opts.reason,
      notes: opts.notes,
    });
    console.log('Inbound recorded:', movement);
  });

stockCommand
  .command('outbound')
  .description('Record an outbound stock movement')
  .requiredOption('--product-id <id>', 'Product ID')
  .requiredOption('--quantity <qty>', 'Quantity')
  .requiredOption('--unit-cost <cost>', 'Unit cost')
  .option('--reason <reason>', 'Reason', 'sale')
  .option('--notes <notes>', 'Notes', '')
  .action(async (opts) => {
    const movement = await stockService.recordOutbound({
      product_id: Number(opts.productId),
      quantity: Number(opts.quantity),
      unit_cost: Number(opts.unitCost),
      reason: opts.reason,
      notes: opts.notes,
    });
    console.log('Outbound recorded:', movement);
  });

stockCommand
  .command('level <product-id>')
  .description('Check stock level for a product')
  .action(async (productId) => {
    const level = await stockService.getStockLevel(Number(productId));
    console.log(`Stock level for product ${productId}: ${level}`);
  });

stockCommand
  .command('history <product-id>')
  .description('Show stock movement history for a product')
  .action(async (productId) => {
    const movements = await stockService.getMovements(Number(productId));
    if (movements.length === 0) {
      console.log('No movements found.');
      return;
    }
    console.table(movements);
  });
