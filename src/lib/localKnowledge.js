// A few hand-written offline explainers (work with no network and no model).
export const localKnowledge = [
  {
    match: /\bphotosynthesis\b/i, title: 'Photosynthesis', topic: 'science', visual: 'photosynthesis',
    md: `**Photosynthesis** is how green plants, algae and some bacteria turn light energy into chemical energy stored in sugar.

### How it works
1. Roots absorb **water**; leaves take in **carbon dioxide** through tiny pores (stomata).
2. **Chlorophyll** in chloroplasts absorbs sunlight.
3. Light energy is used to build **glucose**; **oxygen** is released.

### Word equation
Carbon dioxide + water + light energy → glucose + oxygen

### Why it matters
It feeds almost every food chain, stores energy, and supplies the oxygen in our air.`,
  },
  {
    match: /^\s*(?:(?:what is|explain|tell me about)\s+)?(?:a\s+)?plants?\??\s*$/i, title: 'Plants', topic: 'science', visual: 'plant',
    md: `**Plants** are living organisms of the kingdom Plantae. Most make their own food by photosynthesis and have cell walls made of cellulose.

### Main parts
- **Roots** – absorb water and minerals
- **Stem** – supports and transports materials
- **Leaves** – capture light and exchange gases
- **Flowers, fruits, seeds** – reproduction

### Why they matter
They produce oxygen, store carbon, protect soil, and supply food, fibre, medicine and habitats.`,
  },
  {
    match: /^\s*(what is )?(the )?water cycle\??\s*$/i, title: 'The water cycle', topic: 'science', visual: 'water-cycle',
    md: `The **water cycle** is the continuous movement of water between Earth's surface and the atmosphere.

### Main steps
1. **Evaporation / transpiration** – water becomes vapour
2. **Condensation** – vapour forms clouds
3. **Precipitation** – rain, snow or hail
4. **Runoff & infiltration** – water returns to rivers, soil and groundwater

### Why it matters
It renews fresh water, moves heat around the planet and sustains ecosystems.`,
  },
];
export const findLocal = (q) => localKnowledge.find((k) => k.match.test(q));
