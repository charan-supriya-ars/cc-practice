#!/usr/bin/env node
import { Command } from 'commander';
import { getClient } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { productCommand } from './commands/product.cmd.js';
import { stockCommand } from './commands/stock.cmd.js';
import { orderCommand } from './commands/order.cmd.js';
import { shipmentCommand } from './commands/shipment.cmd.js';
import { campaignCommand } from './commands/campaign.cmd.js';
import { accountingCommand } from './commands/accounting.cmd.js';

const program = new Command();

program
  .name('inventory')
  .description('CLI inventory management system')
  .version('1.0.0')
  .hook('preAction', async () => {
    const client = getClient();
    await runMigrations(client);
  });

program.addCommand(productCommand);
program.addCommand(stockCommand);
program.addCommand(orderCommand);
program.addCommand(shipmentCommand);
program.addCommand(campaignCommand);
program.addCommand(accountingCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
