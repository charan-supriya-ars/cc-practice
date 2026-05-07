import { Command } from 'commander';
import * as accountingService from '../services/accounting.service.js';

export const accountingCommand = new Command('accounting')
  .description('Accounting and reports');

accountingCommand
  .command('sales-report')
  .description('Generate sales report')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (opts) => {
    const report = await accountingService.getSalesReport(opts.start, opts.end);
    console.log('=== Sales Report ===');
    console.log(report.summary);
    if (report.top_products.length > 0) {
      console.log('\nTop Products:');
      console.table(report.top_products);
    }
  });

accountingCommand
  .command('inventory-valuation')
  .description('Show inventory valuation')
  .action(async () => {
    const valuation = await accountingService.getInventoryValuation();
    console.table(valuation.items);
    console.log(`\nTotal valuation: ${valuation.total_valuation}`);
  });

accountingCommand
  .command('movement-summary')
  .description('Show stock movement summary')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (opts) => {
    const summary = await accountingService.getMovementSummary(opts.start, opts.end);
    if (summary.length === 0) {
      console.log('No movements in this period.');
      return;
    }
    console.table(summary);
  });
