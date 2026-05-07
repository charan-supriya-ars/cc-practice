import { Command } from 'commander';
import * as productService from '../services/product.service.js';

export const productCommand = new Command('product')
  .description('Manage products');

productCommand
  .command('add')
  .description('Add a new product')
  .requiredOption('--sku <sku>', 'Product SKU')
  .requiredOption('--name <name>', 'Product name')
  .option('--description <desc>', 'Description', '')
  .requiredOption('--unit-price <price>', 'Unit price')
  .requiredOption('--cost-price <price>', 'Cost price')
  .action(async (opts) => {
    const product = await productService.createProduct({
      sku: opts.sku,
      name: opts.name,
      description: opts.description,
      unit_price: Number(opts.unitPrice),
      cost_price: Number(opts.costPrice),
    });
    console.log('Product created:', product);
  });

productCommand
  .command('list')
  .description('List all products')
  .action(async () => {
    const products = await productService.getAllProducts();
    if (products.length === 0) {
      console.log('No products found.');
      return;
    }
    console.table(products);
  });

productCommand
  .command('get <id>')
  .description('Get a product by ID')
  .action(async (id) => {
    const product = await productService.getProductById(Number(id));
    if (!product) {
      console.error(`Product ${id} not found.`);
      process.exitCode = 1;
      return;
    }
    console.log(product);
  });

productCommand
  .command('update <id>')
  .description('Update a product')
  .option('--name <name>', 'Product name')
  .option('--description <desc>', 'Description')
  .option('--unit-price <price>', 'Unit price')
  .option('--cost-price <price>', 'Cost price')
  .action(async (id, opts) => {
    const product = await productService.updateProduct(Number(id), {
      name: opts.name,
      description: opts.description,
      unit_price: opts.unitPrice !== undefined ? Number(opts.unitPrice) : undefined,
      cost_price: opts.costPrice !== undefined ? Number(opts.costPrice) : undefined,
    });
    console.log('Product updated:', product);
  });

productCommand
  .command('delete <id>')
  .description('Delete a product')
  .action(async (id) => {
    await productService.deleteProduct(Number(id));
    console.log(`Product ${id} deleted.`);
  });
