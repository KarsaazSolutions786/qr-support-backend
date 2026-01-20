/**
 * Extract and compare shape lists
 */

// Laravel shapes (from FeatureRegistry.php lines 100-176)
const laravelShapes = [
    'apple', 'bag', 'bakery', 'barn', 'bear', 'book', 'boot', 'brain',
    'builder', 'bulb', 'burger', 'car', 'circle', 'cloud', 'cooking', 'cup',
    'dentist', 'electrician', 'fish', 'flower', 'food', 'furniture', 'gardening',
    'gift', 'golf', 'gym', 'heart', 'home', 'home-mover', 'ice-cream', 'juice',
    'leaf', 'legal', 'locksmith', 'message', 'mobile', 'painter', 'pest', 'pet',
    'piggy-bank', 'pizza', 'plumber', 'realtor', 'realtor-sign', 'restaurant',
    'salon', 'search', 'shawarma', 'shield', 'shirt', 'shopping-cart', 'star',
    'sun', 'sunrise', 'teddy', 'ticket', 'travel', 'tree', 'trophy', 'truck',
    'umbrella', 'van', 'watch', 'water', 'water-glass'
];

// Node.js shapes (from previewController.js)
const nodeShapes = [
    'apple', 'bakery', 'burger', 'cup', 'food', 'ice-cream', 'juice', 'pizza',
    'shawarma', 'water-glass', 'bag', 'gift', 'shopping-cart', 'piggy-bank',
    'realtor', 'realtor-sign', 'search', 'ticket', 'trophy', 'travel',
    'builder', 'dentist', 'electrician', 'furniture', 'gardening', 'legal',
    'locksmith', 'painter', 'pest', 'plumber', 'salon', 'gym', 'pet',
    'book', 'boot', 'bulb', 'car', 'cloud', 'home', 'message', 'mobile',
    'star', 'sun', 'sunrise', 'teddy', 'truck', 'umbrella', 'van', 'watch',
    'barn', 'shirt', 'circle', 'shield', 'brain', 'leaf', 'tree', 'water',
    'flower', 'heart', 'fish', 'bear'
];

console.log('='.repeat(60));
console.log('SHAPE LIST COMPARISON');
console.log('='.repeat(60));
console.log(`\nLaravel has: ${laravelShapes.length} shapes`);
console.log(`Node.js has: ${nodeShapes.length} shapes\n`);

// Find missing in Node.js
const missingInNode = laravelShapes.filter(s => !nodeShapes.includes(s));
if (missingInNode.length > 0) {
    console.log(`❌ Missing in Node.js (${missingInNode.length}):`, missingInNode.join(', '));
} else {
    console.log('✅ All Laravel shapes are in Node.js detection list!');
}

// Find extra in Node.js (not in Laravel)
const extraInNode = nodeShapes.filter(s => !laravelShapes.includes(s));
if (extraInNode.length > 0) {
    console.log(`⚠️  Extra in Node.js (${extraInNode.length}):`, extraInNode.join(', '));
}

console.log('\n' + '='.repeat(60));
console.log(`Result: ${nodeShapes.length === laravelShapes.length && missingInNode.length === 0 ? '✅ PERFECT MATCH!' : '⚠️  MISMATCH DETECTED'}`);
console.log('='.repeat(60));
