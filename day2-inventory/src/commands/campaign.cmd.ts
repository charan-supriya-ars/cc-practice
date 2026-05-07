import { Command } from 'commander';
import * as campaignService from '../services/campaign.service.js';

export const campaignCommand = new Command('campaign')
  .description('Manage campaigns');

campaignCommand
  .command('create')
  .description('Create a new campaign')
  .requiredOption('--name <name>', 'Campaign name')
  .requiredOption('--type <type>', 'Discount type: percentage or fixed')
  .requiredOption('--value <value>', 'Discount value')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (opts) => {
    const campaign = await campaignService.createCampaign({
      name: opts.name,
      discount_type: opts.type,
      discount_value: Number(opts.value),
      start_date: opts.start,
      end_date: opts.end,
    });
    console.log('Campaign created:', campaign);
  });

campaignCommand
  .command('list')
  .description('List active campaigns')
  .action(async () => {
    const campaigns = await campaignService.getActiveCampaigns();
    if (campaigns.length === 0) {
      console.log('No active campaigns found.');
      return;
    }
    console.table(campaigns);
  });

campaignCommand
  .command('add-product')
  .description('Add a product to a campaign')
  .requiredOption('--campaign-id <id>', 'Campaign ID')
  .requiredOption('--product-id <id>', 'Product ID')
  .action(async (opts) => {
    await campaignService.addProductToCampaign(Number(opts.campaignId), Number(opts.productId));
    console.log(`Product ${opts.productId} added to campaign ${opts.campaignId}.`);
  });

campaignCommand
  .command('remove-product')
  .description('Remove a product from a campaign')
  .requiredOption('--campaign-id <id>', 'Campaign ID')
  .requiredOption('--product-id <id>', 'Product ID')
  .action(async (opts) => {
    await campaignService.removeProductFromCampaign(Number(opts.campaignId), Number(opts.productId));
    console.log(`Product ${opts.productId} removed from campaign ${opts.campaignId}.`);
  });
