import { config } from "dotenv";
config();

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Helper to parse date string (DD/MM/YYYY or ISO format)
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  // Check if it's DD/MM/YYYY format
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}`).toISOString();
  }
  
  // Otherwise assume ISO format
  return new Date(dateStr).toISOString();
}

// ==================== STOCK DATA ====================
const stockData = [
  { name: "MicroTik Devices", category: "Network", productType: "network", quantity: 1, available: 1, faulty: 0, description: "", minStock: 2, location: "IT Storage",
    specs: { type: "Router", brand: "MikroTik", speed: "1 Gbps" } },
  { name: "CPU Systems", category: "Hardware", productType: "desktop", quantity: 9, available: 3, faulty: 6, description: "6 without motherboard and power supply", minStock: 5, location: "IT Storage",
    specs: { brand: "Generic" } },
  { name: "RAM Sticks", category: "Components", productType: "ram", quantity: 14, available: 14, faulty: 0, description: "7 PC (DIMM), 7 Laptop SODIMM (3 DDR3, 4 DDR4)", minStock: 10, location: "IT Storage",
    specs: { type: "DDR3/DDR4", formFactor: "DIMM & SODIMM" } },
  { name: "HDD", category: "Storage", productType: "storage", quantity: 5, available: 5, faulty: 0, description: "3.5 inch desktop hard drives", minStock: 5, location: "IT Storage",
    specs: { type: "HDD", formFactor: "3.5\"", capacity: "500 GB" } },
  { name: "RJ45 Connectors", category: "Network", productType: "other", quantity: 100, available: 100, faulty: 0, description: "1 Box of Cat6 connectors", minStock: 50, location: "IT Storage",
    specs: { brand: "Generic", model: "Cat6 RJ45" } },
  { name: "LCD Monitors", category: "Display", productType: "monitor", quantity: 18, available: 3, faulty: 15, description: "3 new 24-inch, 15 old models", minStock: 5, location: "IT Storage",
    specs: { size: "24\"", resolution: "1920x1080", panelType: "IPS" } },
  { name: "Laptops", category: "Systems", productType: "laptop", quantity: 7, available: 4, faulty: 3, description: "4 Ready, 3 Faulty — mixed i5/i7 8th Gen", minStock: 5, location: "IT Storage",
    specs: { ram: "8 GB", storage: "256 GB", processor: "i5", generation: "8th Gen", brand: "Dell" } },
  { name: "Motherboards", category: "Components", productType: "other", quantity: 2, available: 2, faulty: 0, description: "LGA 1151 socket, compatible with 8th/9th Gen Intel", minStock: 3, location: "IT Storage",
    specs: { brand: "Generic", model: "LGA 1151" } },
  { name: "Wireless Mouse", category: "Peripherals", productType: "mouse", quantity: 0, available: 0, faulty: 0, description: "Out of stock — reorder needed", minStock: 5, location: "IT Storage",
    specs: { connectivity: "Wireless", brand: "Logitech" } },
  { name: "Wired Mouse", category: "Peripherals", productType: "mouse", quantity: 5, available: 5, faulty: 0, description: "Logitech B100 wired optical mouse", minStock: 5, location: "IT Storage",
    specs: { connectivity: "Wired", dpi: "1000", brand: "Logitech" } },
  { name: "Wired Keyboard", category: "Peripherals", productType: "keyboard", quantity: 3, available: 3, faulty: 0, description: "Dell standard wired keyboards", minStock: 5, location: "IT Storage",
    specs: { layout: "Full", connectivity: "Wired", brand: "Dell" } },
  { name: "Mouse Pad", category: "Peripherals", productType: "other", quantity: 3, available: 3, faulty: 0, description: "Standard black mouse pads", minStock: 5, location: "IT Storage",
    specs: { brand: "Generic" } },
  { name: "256 GB SSD NVMe (Laptop)", category: "Storage", productType: "storage", quantity: 2, available: 2, faulty: 0, description: "M.2 NVMe laptop SSDs for upgrades", minStock: 3, location: "IT Storage",
    specs: { capacity: "256 GB", type: "SSD NVMe", formFactor: "M.2" } },
  { name: "8 GB RAM DDR4 (Laptop)", category: "Components", productType: "ram", quantity: 4, available: 4, faulty: 0, description: "SODIMM DDR4 laptop RAM sticks", minStock: 5, location: "IT Storage",
    specs: { capacity: "8 GB", type: "DDR4", formFactor: "SODIMM", speed: "2666 MHz" } },
  { name: "USB Hub", category: "Peripherals", productType: "other", quantity: 3, available: 3, faulty: 0, description: "4-port USB 3.0 hubs", minStock: 3, location: "IT Storage",
    specs: { brand: "Generic", model: "4-port USB 3.0" } },
  { name: "TP-Link Archer C80 Router", category: "Network", productType: "network", quantity: 1, available: 1, faulty: 0, description: "AC 1900 dual-band Wi-Fi router for conference room", minStock: 1, location: "IT Storage",
    specs: { type: "Router", speed: "1 Gbps", brand: "TP-Link", ports: "4 LAN + 1 WAN" } },
  { name: "Logitech H390 Headphones", category: "Peripherals", productType: "headphones", quantity: 4, available: 4, faulty: 0, description: "USB wired headset with noise-cancelling mic", minStock: 5, location: "IT Storage",
    specs: { connectivity: "USB", type: "Over-ear", brand: "Logitech" } },
];

// ==================== ASSIGNED SYSTEMS DATA ====================
const systemsData = [
  { assetId: "AST-2025-001", userName: "Sohail Ahmad", userEmail: "sohail.ahmad@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-002", userName: "Arbaz Ahmed Khan", userEmail: "arbaz.khan@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-003", userName: "Saad Subzwari", userEmail: "saad.subzwari@company.com", ram: "16 GB", storage: "224 GB", processor: "i5", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-004", userName: "Nate", userEmail: "nate@company.com", ram: "16 GB", storage: "477 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-005", userName: "Luke", userEmail: "luke@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-006", userName: "Marcus", userEmail: "marcus@company.com", ram: "12 GB", storage: "585 GB", processor: "i5", generation: "3rd Gen", status: "assigned" },
  { assetId: "AST-2025-007", userName: "Elijah", userEmail: "elijah@company.com", ram: "8 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-008", userName: "Zubair Javed", userEmail: "zubair.javed@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-009", userName: "Liam", userEmail: "liam@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-010", userName: "Cory Hill", userEmail: "cory.hill@company.com", ram: "12 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-011", userName: "Troy", userEmail: "troy@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "11th Gen", status: "assigned" },
  { assetId: "AST-2025-012", userName: "Jordan", userEmail: "jordan@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-013", userName: "Neil", userEmail: "neil@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-014", userName: "Fahad", userEmail: "fahad@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-015", userName: "Masab", userEmail: "masab@company.com", ram: "16 GB", storage: "238 GB", processor: "i5", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-016", userName: "Jamie", userEmail: "jamie@company.com", ram: "12 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-017", userName: "Gavin", userEmail: "gavin@company.com", ram: "32 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-018", userName: "Alan", userEmail: "alan@company.com", ram: "8 GB", storage: "238 GB", processor: "i5", generation: "6th Gen", status: "assigned" },
  { assetId: "AST-2025-019", userName: "Blake Riley", userEmail: "blake.riley@company.com", ram: "8 GB", storage: "238 GB", processor: "i5", generation: "8th Gen", status: "assigned" },
  { assetId: "AST-2025-020", userName: "Taqi Mirza", userEmail: "taqi.mirza@company.com", ram: "12 GB", storage: "128 GB", processor: "i7", generation: "8th Gen", status: "assigned", assignedDate: "22/12/2025" },
  { assetId: "AST-2025-021", userName: "Will Evans", userEmail: "will.evans@company.com", ram: "8 GB", storage: "128 GB", processor: "i5", generation: "8th Gen", status: "assigned", assignedDate: "22/12/2025" },
  { assetId: "AST-2025-022", userName: "James Perry", userEmail: "james.perry@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned", assignedDate: "06/01/2026" },
  { assetId: "AST-2025-023", userName: "Osama Bin Ramzan", userEmail: "osama.ramzan@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "assigned", assignedDate: "06/01/2026" },
  { assetId: "AST-2025-024", userName: "Musawar Ali", userEmail: "musawar.ali@company.com", ram: "16 GB", storage: "128 GB", processor: "i5", generation: "11th Gen", status: "assigned" },
  { assetId: "AST-2025-025", userName: "Zubair Javed", userEmail: "zubair.javed@company.com", ram: "16 GB", storage: "238 GB", processor: "i7", generation: "8th Gen", status: "home", notes: "Home System" },
  { assetId: "AST-2025-026", userName: "Mam Leena", userEmail: "leena@company.com", ram: "16 GB", storage: "256 GB SSD", processor: "i5", generation: "11th Gen", status: "assigned", assignedDate: "08/01/2026" },
];

// ==================== PROCUREMENT DATA ====================
const procurementData = [
  { itemName: "LCD 24 inch Dell", quantity: 4, unitPrice: 14500, totalPrice: 58000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 to Osama" },
  { itemName: "Logitech H390 Headphones", quantity: 5, unitPrice: 8300, totalPrice: 41500, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 to Musawar Ali" },
  { itemName: "Logitech B100 Wired Mouse", quantity: 5, unitPrice: 1250, totalPrice: 6250, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received" },
  { itemName: "TP-Link Archer C80 AC1900 Router", quantity: 1, unitPrice: 16000, totalPrice: 16000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received" },
  { itemName: "Wired Dell Keyboard", quantity: 4, unitPrice: 800, totalPrice: 3200, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 to Cory" },
  { itemName: "Wireless Logitech Keyboard", quantity: 1, unitPrice: 5000, totalPrice: 5000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "Troy" },
  { itemName: "256 GB SSD NVMe (Laptop)", quantity: 2, unitPrice: 8000, totalPrice: 16000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received" },
  { itemName: "8 GB RAM DDR4 (Laptop)", quantity: 2, unitPrice: 11000, totalPrice: 22000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received" },
  { itemName: "Hard Disk Reader", quantity: 1, unitPrice: 1500, totalPrice: 1500, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "Arbaz IT" },
  { itemName: "Mouse Pad", quantity: 5, unitPrice: 200, totalPrice: 1000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 Arbaz, 1 Sohail" },
  { itemName: "Marker Permanent (Blue)", quantity: 2, unitPrice: 100, totalPrice: 200, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 Arbaz HR" },
  { itemName: "Stapler Pins", quantity: 2, unitPrice: 150, totalPrice: 300, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received", assignedTo: "1 Arbaz HR" },
  { itemName: "USB Hub", quantity: 3, unitPrice: 2000, totalPrice: 6000, vendor: "Ahtshyam Vendor", purchaseDate: "22/01/2026", status: "received" },
];

// ==================== RECEIVED ITEMS DATA ====================
const receivedData = [
  { itemName: "Mouse", quantity: 10, receivedDate: "20/12/2025", category: "Peripherals" },
  { itemName: "Double Side Tape", quantity: 6, receivedDate: "20/12/2025", category: "Supplies" },
  { itemName: "White Tape", quantity: 6, receivedDate: "20/12/2025", category: "Supplies" },
  { itemName: "Computer Repair Toolkit", quantity: 1, receivedDate: "24/12/2025", category: "Tools" },
  { itemName: "Screw Driver", quantity: 1, receivedDate: "24/12/2025", category: "Tools" },
  { itemName: "Power Cable", quantity: 5, receivedDate: "24/12/2025", category: "Cables" },
  { itemName: "VGA Cable", quantity: 5, receivedDate: "24/12/2025", category: "Cables" },
  { itemName: "Headphone", quantity: 5, receivedDate: "24/12/2025", category: "Peripherals" },
  { itemName: "Plug Socket Box", quantity: 1, receivedDate: "26/12/2025", category: "Electrical" },
  { itemName: "Toshiba Cell (Small Box)", quantity: 2, receivedDate: "26/12/2025", category: "Supplies", notes: "Received 1 box" },
  { itemName: "Office Bell", quantity: 1, receivedDate: "26/12/2025", category: "Office" },
  { itemName: "Printer Cartridge HP MFP M28w", quantity: 1, receivedDate: "26/12/2025", category: "Printer" },
  { itemName: "Eraser", quantity: 2, receivedDate: "26/12/2025", category: "Supplies" },
  { itemName: "Cable Tie Packet", quantity: 1, receivedDate: "26/12/2025", category: "Supplies" },
  { itemName: "TP-Link TL-LS1008 Switch", quantity: 2, receivedDate: "26/12/2025", category: "Network" },
  { itemName: "Laptop 16GB RAM 256GB SSD", quantity: 2, receivedDate: "08/01/2026", category: "Systems", notes: "1 to Mam Leena, 1 to Musawar Ali" },
  { itemName: "Logitech H390 Headphones", quantity: 5, receivedDate: "22/01/2026", category: "Peripherals" },
];

// ==================== INVOICES DATA ====================
const invoicesData = [
  { invoiceNumber: "INV-2026-001", vendor: "TechZone Pakistan", purchaseDate: "2026-01-25", totalAmount: 142500, items: "3x 256GB SSD NVMe, 4x 8GB DDR4 RAM", status: "paid", notes: "Bulk purchase for system upgrades" },
  { invoiceNumber: "INV-2026-002", vendor: "CompuMart Lahore", purchaseDate: "2026-01-20", totalAmount: 85000, items: "2x Logitech H390 Headphones, 5x USB Hub", status: "paid", notes: "" },
  { invoiceNumber: "INV-2026-003", vendor: "Network Solutions", purchaseDate: "2026-01-18", totalAmount: 12500, items: "1x TP-Link Archer C80 Router", status: "paid", notes: "For conference room" },
  { invoiceNumber: "INV-2026-004", vendor: "PC World Karachi", purchaseDate: "2026-02-01", totalAmount: 245000, items: "2x Dell Laptop Core i5 12th Gen", status: "pending", notes: "Awaiting delivery confirmation" },
  { invoiceNumber: "INV-2025-089", vendor: "Electronics Hub", purchaseDate: "2025-12-15", totalAmount: 67500, items: "5x LCD Monitors 24-inch", status: "paid", notes: "Year-end purchase" },
];

// ==================== SUPPORT TICKETS DATA ====================
const ticketsData = [
  { 
    ticketNumber: "TKT-2026-0001", 
    assetName: "Laptop - Taqi Mirza", 
    title: "Laptop running slow after Windows update", 
    description: "After the latest Windows update, my laptop has become noticeably slower.", 
    priority: "medium", 
    status: "open", 
    createdByName: "Taqi Mirza", 
    createdByEmail: "taqi.mirza@company.com", 
    createdByDepartment: "IT",
    createdAt: "2026-02-01T10:30:00Z"
  },
  { 
    ticketNumber: "TKT-2026-0002", 
    assetName: "Laptop - Marcus", 
    title: "Hard drive making clicking noise - URGENT", 
    description: "My laptop hard drive is making a clicking noise. 3rd Gen system with HDD may fail soon.", 
    priority: "critical", 
    status: "open", 
    createdByName: "Marcus", 
    createdByEmail: "marcus@company.com", 
    createdByDepartment: "IT",
    createdAt: "2026-02-02T09:15:00Z"
  },
  { 
    ticketNumber: "TKT-2026-0003", 
    assetName: "Laptop - Elijah", 
    title: "Need RAM upgrade - 8GB not sufficient", 
    description: "Current 8GB RAM is not enough for running multiple applications.", 
    priority: "medium", 
    status: "in_progress", 
    createdByName: "Elijah", 
    createdByEmail: "elijah@company.com", 
    createdByDepartment: "IT",
    createdAt: "2026-01-28T14:00:00Z"
  },
];

async function seedAssets() {
  try {
    console.log("🌱 Seeding IT Assets into database...\n");

    // Clear existing data (optional - comment out if you want to keep existing)
    console.log("🗑️  Clearing existing asset data...");
    await sql`DELETE FROM ticket_comments`;
    await sql`DELETE FROM support_tickets`;
    await sql`DELETE FROM invoices`;
    await sql`DELETE FROM received_items`;
    await sql`DELETE FROM procurement_items`;
    await sql`DELETE FROM assigned_systems`;
    await sql`DELETE FROM stock_items`;
    console.log("  ✓ Existing data cleared\n");

    // Seed Stock Items
    console.log("📦 Seeding Stock Items...");
    for (const item of stockData) {
      await sql`
        INSERT INTO stock_items (name, category, product_type, quantity, available, faulty, description, min_stock, location, specs)
        VALUES (${item.name}, ${item.category}, ${item.productType || null}, ${item.quantity}, ${item.available}, ${item.faulty}, ${item.description || null}, ${item.minStock}, ${item.location}, ${item.specs ? JSON.stringify(item.specs) : null})
      `;
      console.log(`  ✓ ${item.name}`);
    }
    console.log(`  Total: ${stockData.length} stock items\n`);

    // Seed Assigned Systems
    console.log("💻 Seeding Assigned Systems...");
    const systemIdMap = new Map<string, string>();
    for (const sys of systemsData) {
      const result = await sql`
        INSERT INTO assigned_systems (asset_id, user_name, user_email, ram, storage, processor, generation, status, assigned_date, notes)
        VALUES (
          ${sys.assetId}, 
          ${sys.userName}, 
          ${sys.userEmail}, 
          ${sys.ram}, 
          ${sys.storage}, 
          ${sys.processor}, 
          ${sys.generation}, 
          ${sys.status}, 
          ${sys.assignedDate ? parseDate(sys.assignedDate) : null}, 
          ${(sys as any).notes || null}
        )
        RETURNING id
      `;
      systemIdMap.set(sys.assetId, (result as any)[0].id);
      console.log(`  ✓ ${sys.assetId} - ${sys.userName}`);
    }
    console.log(`  Total: ${systemsData.length} systems\n`);

    // Seed Procurement Items
    console.log("🛒 Seeding Procurement Items...");
    for (const item of procurementData) {
      await sql`
        INSERT INTO procurement_items (item_name, quantity, unit_price, total_price, vendor, purchase_date, status, assigned_to, notes)
        VALUES (
          ${item.itemName}, 
          ${item.quantity}, 
          ${item.unitPrice}, 
          ${item.totalPrice}, 
          ${item.vendor}, 
          ${parseDate(item.purchaseDate)}, 
          ${item.status}, 
          ${item.assignedTo || null}, 
          ${(item as any).notes || null}
        )
      `;
      console.log(`  ✓ ${item.itemName}`);
    }
    console.log(`  Total: ${procurementData.length} procurement items\n`);

    // Seed Received Items
    console.log("📥 Seeding Received Items...");
    for (const item of receivedData) {
      await sql`
        INSERT INTO received_items (item_name, quantity, received_date, category, notes)
        VALUES (${item.itemName}, ${item.quantity}, ${parseDate(item.receivedDate)}, ${item.category}, ${(item as any).notes || null})
      `;
      console.log(`  ✓ ${item.itemName}`);
    }
    console.log(`  Total: ${receivedData.length} received items\n`);

    // Seed Invoices
    console.log("📄 Seeding Invoices...");
    for (const inv of invoicesData) {
      await sql`
        INSERT INTO invoices (invoice_number, vendor, purchase_date, total_amount, items, status, notes)
        VALUES (${inv.invoiceNumber}, ${inv.vendor}, ${parseDate(inv.purchaseDate)}, ${inv.totalAmount}, ${inv.items}, ${inv.status}, ${inv.notes || null})
      `;
      console.log(`  ✓ ${inv.invoiceNumber}`);
    }
    console.log(`  Total: ${invoicesData.length} invoices\n`);

    // Seed Support Tickets
    console.log("🎫 Seeding Support Tickets...");
    for (const ticket of ticketsData) {
      await sql`
        INSERT INTO support_tickets (
          ticket_number, asset_name, title, description, priority, status,
          created_by_name, created_by_email, created_by_department, created_at
        )
        VALUES (
          ${ticket.ticketNumber}, 
          ${ticket.assetName}, 
          ${ticket.title}, 
          ${ticket.description}, 
          ${ticket.priority}, 
          ${ticket.status},
          ${ticket.createdByName},
          ${ticket.createdByEmail},
          ${ticket.createdByDepartment},
          ${ticket.createdAt}
        )
      `;
      console.log(`  ✓ ${ticket.ticketNumber}`);
    }
    console.log(`  Total: ${ticketsData.length} tickets\n`);

    // Print summary
    console.log("═══════════════════════════════════════════════════");
    console.log("✅ Asset seeding completed successfully!");
    console.log("═══════════════════════════════════════════════════");
    console.log(`   📦 Stock Items:      ${stockData.length}`);
    console.log(`   💻 Systems:          ${systemsData.length}`);
    console.log(`   🛒 Procurement:      ${procurementData.length}`);
    console.log(`   📥 Received Items:   ${receivedData.length}`);
    console.log(`   📄 Invoices:         ${invoicesData.length}`);
    console.log(`   🎫 Tickets:          ${ticketsData.length}`);
    console.log("═══════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Asset seeding failed:", err);
    process.exit(1);
  }
}

seedAssets();
