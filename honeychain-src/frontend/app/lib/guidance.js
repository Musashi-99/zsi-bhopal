/** General post-harvest guidance shown in the assistant. Static content; not product-certified advice. */
export const STAGES = [
  {
    kind: 'drying', title: 'Drying', short: 'Remove moisture', icon: 'sun', tone: 'amber',
    sub: 'Proper drying helps maintain quality and prevents spoilage.',
    why: 'Proper drying reduces moisture content, which helps prevent fungal growth, preserves natural color and improves acceptance by buyers.',
    tasks: [
      ['Dry in a clean, elevated area', 'Use a clean, raised platform or clean sheet to avoid contact with soil.'],
      ['Protect from dust and insects', 'Use a net or cover while drying.'],
      ['Ensure proper air circulation', 'Spread in a thin layer and turn regularly.'],
      ['Avoid direct rain and moisture', 'Bring inside if there is a chance of rain.'],
    ],
    good: ['Keep containers closed when not drying', 'Avoid contamination from dust, smoke or chemicals', 'Dry in a clean, shaded, well-ventilated area', 'Maintain hygiene during handling'],
    bad: ['Drying on bare ground', 'Exposure to smoke or strong odors', 'Contact with dirty containers'],
  },
  {
    kind: 'sorting', title: 'Sorting & Cleaning', short: 'Improve purity', icon: 'leaf', tone: '',
    sub: 'Sorting and cleaning remove impurities and foreign matter.',
    why: 'Removing foreign matter and damaged material improves purity, which many buyers check first.',
    tasks: [
      ['Remove foreign matter and dirt', 'Filter or hand-pick visible foreign matter.'],
      ['Use clean tools and containers', 'Wash and dry tools before use.'],
      ['Separate damaged material', 'Keep damaged or discoloured produce apart.'],
    ],
    good: ['Use clean cloth or fine mesh filters', 'Wash hands and tools', 'Sort in good light'],
    bad: ['Mixing different batches', 'Using dirty containers'],
  },
  {
    kind: 'packaging', title: 'Packaging', short: 'Safe and clean', icon: 'bag', tone: 'orange',
    sub: 'Packaging protects produce from contamination and moisture.',
    why: 'Clean, food-grade packaging protects produce and meets many buyers\' requirements.',
    tasks: [
      ['Use clean, food-grade containers', 'Choose containers suited to the produce.'],
      ['Seal containers tightly', 'Keep out moisture and pests.'],
      ['Label with batch ID and date', 'Helps traceability.'],
    ],
    good: ['Use food-grade, dry containers', 'Label every container', 'Avoid reusing chemical containers'],
    bad: ['Reusing chemical drums', 'Leaving containers open'],
  },
  {
    kind: 'storage', title: 'Storage', short: 'Maintain quality', icon: 'home', tone: 'teal',
    sub: 'Good storage maintains quality until the batch is sold.',
    why: 'Cool, dry storage keeps moisture and quality stable until sale.',
    tasks: [
      ['Store in a cool, dry place', 'Away from direct sunlight and damp walls.'],
      ['Keep off the floor', 'Use pallets or shelves.'],
      ['Check regularly', 'Inspect for moisture, pests and smell.'],
    ],
    good: ['Cool, dry, ventilated room', 'Raised shelves', 'Regular checks'],
    bad: ['Damp rooms', 'Storing near fuel or chemicals'],
  },
  {
    kind: 'transport', title: 'Transport', short: 'Prevent damage', icon: 'truck', tone: 'blue',
    sub: 'Transport carefully to avoid damage and contamination.',
    why: 'Careful transport prevents damage, spillage and contamination.',
    tasks: [
      ['Use clean, covered transport', 'Protect from rain, dust and heat.'],
      ['Avoid mixing with other goods', 'Especially strong-smelling items.'],
      ['Keep records of the movement', 'Date, vehicle and destination.'],
    ],
    good: ['Covered vehicle', 'Secure containers', 'Short transit time'],
    bad: ['Open trucks in rain', 'Rough handling'],
  },
];
