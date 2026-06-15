import { PrismaClient } from '../node_modules/.prisma/client/index.js'

const prisma = new PrismaClient()

// ── Category IDs ───────────────────────────────────────────────
const CAT = {
  mtgSingle:  'cmp9flcjn00006r8azfshgrx7',
  mtgSealed:  'cmp9flcjt00016r8a6avawgno',
  paint:      'cmp9flcju00026r8aigrf1slw',
  rbSealed:   'cmp9flcjv00036r8ai2s8tefp',
  rbSingle:   'cmp9flcjw00046r8aiesh5j3k',
}

// ── Helpers ────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function maybe(val, prob = 0.5) { return Math.random() < prob ? val : null }
function price(min, max, step = 10) {
  const steps = Math.floor((max - min) / step)
  return min + rand(0, steps) * step
}

// ── MTG Singles ────────────────────────────────────────────────
const MTG_CREATURES = [
  'Ragavan, Nimble Pilferer','Murktide Regent','Solitude','Grief','Subtlety',
  'Endurance','Fury','Cauldron Familiar','Omnath, Locus of Creation',
  'Atraxa, Grand Unifier','Sheoldred, the Apocalypse','Raffine, Scheming Seer',
  'Lurrus of the Dream-Den','Kroxa, Titan of Death\'s Hunger','Uro, Titan of Nature\'s Wrath',
  'Yorion, Sky Nomad','Kaheera, the Orphanguard','Jegantha, the Wellspring',
  'Gyruda, Doom of Depths','Keruga, the Macrosage','Obosh, the Preypiercer',
  'Umori, the Collector','Lutri, the Spellchaser','Zirda, the Dawnwaker',
  'Emrakul, the Promised End','Ulamog, the Ceaseless Hunger','Griselbrand',
  'Progenitus','Blightsteel Colossus','Jin-Gitaxias, Core Augur',
  'Thassa\'s Oracle','Laboratory Maniac','Jace, Wielder of Mysteries',
  'Death\'s Shadow','Gurmag Angler','Tarmogoyf','Dark Confidant',
  'Stoneforge Mystic','Mother of Runes','Esper Sentinel',
  'Dragon\'s Rage Channeler','Ledger Shredder','Delver of Secrets',
  'Young Pyromancer','Monastery Swiftspear','Champion of the Parish',
  'Thalia, Guardian of Thraben','Leonin Arbiter','Aven Mindcensor',
  'Noble Hierarch','Birds of Paradise','Llanowar Elves','Elvish Mystic',
  'Collector Ouphe','Archon of Emeria','Drannith Magistrate',
  'Sanctifier en-Vec','Magus of the Moon','Blood Moon (Creature)',
  'Magus of the Tabernacle','Dauthi Voidwalker','Yawgmoth, Thran Physician',
  'Grist, the Hunger Tide','Orcish Bowmasters','Bowmaster Elf',
  'Aether Vial','Chalice of the Void','Trinisphere','Sphere of Resistance',
  'Void Mirror','Grafdigger\'s Cage','Damping Sphere','Relic of Progenitus',
  'Phyrexian Revoker','Phyrexian Metamorph','Snapcaster Mage','Vendilion Clique',
  'Spellseeker','Eternal Witness','Reclamation Sage','Knight of Autumn',
  'Tireless Tracker','Courser of Kruphix','Wall of Roots',
  'Devoted Druid','Vizier of Remedies','Spike Feeder','Archangel of Thune',
  'Kiki-Jiki, Mirror Breaker','Deceiver Exarch','Pestermite','Village Bell-Ringer',
  'Felidar Guardian','Saheeli Rai (Creature)','Sun Titan','Restoration Angel',
  'Flickerwisp','Blade Splicer','Leonin Relic-Warder',
]

const MTG_SPELLS = [
  'Lightning Bolt','Counterspell','Force of Will','Force of Negation',
  'Brainstorm','Ponder','Preordain','Serum Visions','Opt',
  'Fatal Push','Path to Exile','Swords to Plowshares','Vindicate',
  'Inquisition of Kozilek','Thoughtseize','Duress','Cabal Therapy',
  'Gitaxian Probe','Dismember','Unholy Heat','Mishra\'s Bauble',
  'Crop Rotation','Green Sun\'s Zenith','Living Wish','Burning Wish',
  'Tinker','Show and Tell','Emrakul Summoning','Sneak Attack',
  'Through the Breach','Goryo\'s Vengeance','Unburial Rites',
  'Animate Dead','Reanimate','Exhume','Dread Return',
  'Accumulated Knowledge','Gifts Ungiven','Intuition','Fact or Fiction',
  'Dig Through Time','Treasure Cruise','Ancestral Recall','Time Walk',
  'Mox Ruby','Mox Sapphire','Mox Pearl','Mox Emerald','Mox Jet',
  'Black Lotus','Time Vault','Mana Drain','Mana Crypt','Sol Ring',
  'Ancient Tomb','City of Traitors','Dark Ritual','Cabal Ritual',
  'Chrome Mox','Mox Diamond','Lion\'s Eye Diamond','Lotus Petal',
  'Pyrexian Altar','Ashnod\'s Altar','Altar of Dementia',
  'Phyrexian Arena','Necropotence','Night\'s Whisper','Sign in Blood',
  'Faithless Looting','Careful Study','Frantic Search','Merchant Scroll',
  'Personal Tutor','Mystical Tutor','Vampiric Tutor','Demonic Tutor',
  'Imperial Seal','Scheming Symmetry','Lim-Dûl\'s Vault',
  'Accumulated Knowledge','Deep Analysis','Compulsive Research',
  'Windfall','Wheel of Fortune','Timetwister','Memory Jar',
]

const MTG_LANDS = [
  'Fetchland (Scalding Tarn)','Fetchland (Misty Rainforest)','Fetchland (Verdant Catacombs)',
  'Fetchland (Arid Mesa)','Fetchland (Marsh Flats)','Fetchland (Flooded Strand)',
  'Fetchland (Polluted Delta)','Fetchland (Bloodstained Mire)','Fetchland (Wooded Foothills)',
  'Fetchland (Windswept Heath)','Underground Sea','Tropical Island','Volcanic Island',
  'Tundra','Badlands','Savannah','Taiga','Bayou','Scrubland','Plateau',
  'Wasteland','Strip Mine','Ghost Quarter','Field of Ruin','Horizon Canopy',
  'Silent Clearing','Nurturing Peatland','Sunbaked Canyon','Fiery Islet',
  'Waterlogged Grove','Urza\'s Saga','Urza\'s Tower','Urza\'s Mine','Urza\'s Power Plant',
  'Cavern of Souls','Karakas','Dark Depths','Thespian\'s Stage','Valakut, the Molten Pinnacle',
  'Inkmoth Nexus','Blinkmoth Nexus','Mutavault','Celestial Colonnade',
  'Creeping Tar Pit','Lavaclaw Reaches','Stirring Wildwood','Raging Ravine',
  'Grove of the Burnwillows','Horizon Canopy','Gemstone Mine','City of Brass',
  'Mana Confluence','Glimmervoid','Forbidden Orchard','Nykthos, Shrine to Nyx',
  'Cabal Coffers','Urborg, Tomb of Yawgmoth','Rishadan Port','Maze of Ith',
]

const MTG_PLANESWALKERS = [
  'Liliana of the Veil','Liliana, the Last Hope','Liliana, Death\'s Majesty',
  'Jace, the Mind Sculptor','Jace, Vryn\'s Prodigy','Jace, Memory Adept',
  'Tezzeret, Agent of Bolas','Tezzeret the Seeker','Tezzeret, Master of the Bridge',
  'Teferi, Hero of Dominaria','Teferi, Time Raveler','Teferi, Mage of Zhalfir',
  'Karn Liberated','Karn, the Great Creator','Karn, Silver Golem',
  'Ugin, the Spirit Dragon','Ugin, the Ineffable','Nicol Bolas, Dragon-God',
  'Elspeth, Sun\'s Champion','Elspeth, Knight-Errant','Elspeth Conquers Death',
  'Wrenn and Six','Wrenn and Realmbreaker','Nissa, Who Shakes the World',
  'Nissa, Worldwaker','Nissa, Vastwood Seer','Vivien Reid',
  'Garruk Wildspeaker','Garruk, Primal Hunter','Garruk Relentless',
  'Chandra, Torch of Defiance','Chandra, Awakened Inferno','Chandra Nalaar',
  'Nahiri, the Harbinger','Nahiri, the Unforgiving','Sorin, Lord of Innistrad',
  'Sorin, Imperious Bloodlord','Domri, Chaos Bringer','Saheeli Rai',
  'Dack Fayden','Daretti, Scrap Savant','Ob Nixilis, the Fallen',
  'Tamiyo, the Moon Sage','Tamiyo, Collector of Tales','Ashiok, Nightmare Weaver',
  'Ashiok, Dream Render','Vraska the Unseen','Vraska, Relic Seeker',
]

const MTG_SETS = [
  'Modern Horizons 2','Modern Horizons 3','Kamigawa: Neon Dynasty','Streets of New Capenna',
  'Dominaria United','The Brothers\' War','Phyrexia: All Will Be One','March of the Machine',
  'Wilds of Eldraine','The Lost Caverns of Ixalan','Murders at Karlov Manor',
  'Outlaws of Thunder Junction','Bloomburrow','Duskmourn: House of Horror',
  'Double Masters 2022','Commander Masters','Universes Beyond: LotR','Ravnica Remastered',
  'Innistrad: Midnight Hunt','Innistrad: Crimson Vow','Strixhaven','Kaldheim',
  'Adventures in the Forgotten Realms','Innistrad: Double Feature',
  'Time Spiral Remastered','Vintage Cube','Legacy Cube','Commander Legends',
  'Zendikar Rising','Ikoria: Lair of Behemoths','Theros Beyond Death',
  'Throne of Eldraine','War of the Spark','Ravnica Allegiance',
  'Guilds of Ravnica','Core Set 2019','Core Set 2020','Core Set 2021',
]

const MTG_RARITIES = ['C','U','R','M']
const MTG_CONDITIONS = ['NM','NM','NM','LP','LP','MP','HP']
const MTG_COLORS = [
  '["W"]','["U"]','["B"]','["R"]','["G"]',
  '["W","U"]','["U","B"]','["B","R"]','["R","G"]','["G","W"]',
  '["W","B"]','["U","R"]','["B","G"]','["R","W"]','["G","U"]',
  '["W","U","B"]','["U","B","R"]','["B","R","G"]','["R","G","W"]','["G","W","U"]',
  '[]',
]
const MTG_FORMATS = [
  '["Modern"]','["Legacy"]','["Vintage"]','["Pioneer"]','["Standard"]',
  '["Modern","Legacy"]','["Modern","Pioneer"]','["Legacy","Vintage"]',
  '["Commander"]','["Modern","Legacy","Commander"]',
]
const MTG_TYPES = ['Creature','Instant','Sorcery','Enchantment','Artifact','Land','Planeswalker','Battle']
const MTG_EMOJIS = ['🃏','⚔️','🛡️','🔥','💧','🌿','💀','✨','🌙','⚡','🗡️','🔮']

// ── MTG Sealed ────────────────────────────────────────────────
const SEALED_PRODUCTS = [
  { name: 'Booster Pack', nameTh: 'บูสเตอร์แพ็ค', cat: 'booster', emoji: '📦', priceMin: 150, priceMax: 350 },
  { name: 'Draft Booster Box', nameTh: 'ดราฟต์บูสเตอร์บ็อกซ์', cat: 'box', emoji: '📦', priceMin: 2800, priceMax: 4500 },
  { name: 'Set Booster Box', nameTh: 'เซ็ตบูสเตอร์บ็อกซ์', cat: 'box', emoji: '📦', priceMin: 3200, priceMax: 5500 },
  { name: 'Collector Booster Box', nameTh: 'คอลเลคเตอร์บูสเตอร์บ็อกซ์', cat: 'collector', emoji: '💎', priceMin: 6500, priceMax: 12000 },
  { name: 'Collector Booster Pack', nameTh: 'คอลเลคเตอร์บูสเตอร์แพ็ค', cat: 'collector', emoji: '💎', priceMin: 450, priceMax: 1200 },
  { name: 'Bundle', nameTh: 'บันเดิล', cat: 'bundle', emoji: '🎁', priceMin: 1200, priceMax: 2000 },
  { name: 'Commander Deck', nameTh: 'คอมมานเดอร์เด็ค', cat: 'commander', emoji: '👑', priceMin: 1500, priceMax: 2800 },
  { name: 'Starter Kit', nameTh: 'สตาร์ทเตอร์คิท', cat: 'starter', emoji: '🎯', priceMin: 350, priceMax: 600 },
  { name: 'Play Booster Box', nameTh: 'เพลย์บูสเตอร์บ็อกซ์', cat: 'box', emoji: '📦', priceMin: 3000, priceMax: 4800 },
  { name: 'Set Booster Pack', nameTh: 'เซ็ตบูสเตอร์แพ็ค', cat: 'booster', emoji: '📦', priceMin: 180, priceMax: 420 },
]

// ── Riftbound Singles ─────────────────────────────────────────
const RB_CARDS = [
  'Ironclad Vanguard','Shadow Weaver','Storm Herald','Void Stalker','Ember Warden',
  'Crystal Sage','Tide Caller','Stone Sentinel','Flame Dancer','Frost Warden',
  'Lightning Striker','Thunder Roar','Sacred Grove','Dark Ritual','Battle Hymn',
  'Soul Breaker','Mind Shatter','Earth Tremor','Wind Slash','Tidal Wave',
  'Inferno Blast','Blizzard Storm','Earthquake Strike','Thunderclap','Solar Flare',
  'Lunar Eclipse','Star Fall','Comet Strike','Nova Burst','Supernova',
  'Phantom Blade','Ghost Step','Shadow Clone','Mirror Image','Double Strike',
  'Power Surge','Energy Drain','Force Field','Magic Barrier','Counter Spell',
  'Dragon\'s Breath','Phoenix Rise','Unicorn Charge','Gryphon Dive','Wyvern Strike',
  'Basilisk Gaze','Chimera Roar','Hydra Strike','Manticore Slash','Sphinx Riddle',
  'Rift Walker','Dimension Gate','Portal Jump','Space Fold','Time Warp',
  'Ancient Dragon','Legendary Hero','Epic Champion','Mythic Guardian','Divine Warrior',
  'Cursed Knight','Dark Mage','Shadow Assassin','Void Reaper','Chaos Bringer',
  'Light Bringer','Holy Paladin','Sacred Priest','Blessed Cleric','Divine Healer',
  'Nature\'s Wrath','Forest Guardian','Tree Spirit','Vine Striker','Root Walker',
  'Sea Serpent','Ocean Caller','Wave Rider','Tide Walker','Deep Diver',
  'Mountain Giant','Rock Golem','Stone Crusher','Cliff Jumper','Peak Climber',
  'Sky Rider','Cloud Dancer','Wind Surfer','Storm Bringer','Thunder Hawk',
]

const RB_SETS = [
  'Core Set Alpha','Rift Rising','Shadow Realm','Dragon\'s Domain','Ocean Depths',
  'Mountain Peak','Forest Ancient','Desert Storm','Frozen Tundra','Volcanic Isle',
  'Celestial Sphere','Infernal Pit','Arcane Academy','Battle Grounds','Lost Ruins',
]

const RB_RARITIES_SINGLES = ['Common','Uncommon','Rare','Epic','Legendary']
const RB_TYPES_SINGLES = ['Unit','Spell','Trap','Relic','Location']
const RB_EMOJIS = ['⚔️','🗡️','🛡️','🔮','✨','💥','🌊','🔥','❄️','🌿','⚡','💀','👑','🐉','🦅']

// ── Riftbound Sealed ──────────────────────────────────────────
const RB_SEALED_PRODUCTS = [
  { name: 'Starter Deck', nameTh: 'สตาร์ทเตอร์เด็ค', cat: 'starter', emoji: '🎯' },
  { name: 'Booster Pack', nameTh: 'บูสเตอร์แพ็ค', cat: 'booster', emoji: '📦' },
  { name: 'Booster Box', nameTh: 'บูสเตอร์บ็อกซ์', cat: 'box', emoji: '📦' },
  { name: 'Elite Pack', nameTh: 'อีลิทแพ็ค', cat: 'elite', emoji: '💎' },
  { name: 'Campaign Box', nameTh: 'แคมเปญบ็อกซ์', cat: 'box', emoji: '🎁' },
]

// ── Paints ───────────────────────────────────────────────────
const PAINT_BRANDS = ['Citadel','Vallejo','Army Painter','Scale75','Reaper','P3','AK Interactive']
const PAINT_TYPES = ['Base','Layer','Shade','Contrast','Dry','Technical','Air','Texture']
const PAINT_COLORS_LIST = [
  'Abaddon Black','Averland Sunset','Balthasar Gold','Bugman\'s Glow',
  'Caledor Sky','Death Guard Green','Eshin Grey','Flash Gitz Yellow',
  'Gehenna\'s Gold','Hoeth Blue','Imperial Primer','Jokaero Orange',
  'Kantor Blue','Leadbelcher','Macragge Blue','Naggaroth Night',
  'Orruk Flesh','Palatine Blue','Rakarth Flesh','Screamer Pink',
  'Tau Light Ochre','Ulthuan Grey','Vulkan Green','White Scar',
  'Xereus Purple','Yriel Yellow','Zandri Dust','Runelord Brass',
  'Ironbreaker','Stormhost Silver','Auric Armour Gold','Retributor Armour',
  'Agrax Earthshade','Nuln Oil','Reikland Fleshshade','Druchii Violet',
  'Coelia Greenshade','Biel-Tan Green','Seraphim Sepia','Carroburg Crimson',
  'Tempestus Blue','Casandora Yellow','Fuegan Orange','Athonian Camoshade',
  'Drakenhof Nightshade','Flesh Tearers Red','Blood Angels Red','Dark Angels Green',
  'Contrast Black Templar','Contrast Ultramarines Blue','Contrast Snakebite Leather',
  'Skeleton Horde','Shyish Purple','Warp Lightning','Volupus Pink',
  'Magos Purple','Terradon Turquoise','Gryph-hound Orange','Gryph-charger Grey',
  'Militarum Green','Talassar Blue','Apothecary White','Aethermatic Blue',
  'Iyanden Yellow','Plague Bearer Flesh','Wyldwood Brown','Gutrippa Flesh',
  'Matt White','Matt Black','Matte Varnish','Gloss Varnish','Satin Varnish',
  'Medium','Lahmian Medium','Ardcoat','Mourn Mountain Snow','Mordant Earth',
]

const PAINT_EMOJIS = ['🎨','🖌️','🖍️','🎭','🎪']

const MODEL_TOOLS = [
  { name: 'Hobby Knife Set', nameTh: 'ชุดมีดโมเดล', cat: 'tools', emoji: '🔪', priceMin: 150, priceMax: 450 },
  { name: 'Precision Tweezers', nameTh: 'แหนบหนีบละเอียด', cat: 'tools', emoji: '🔧', priceMin: 80, priceMax: 250 },
  { name: 'Mould Line Remover', nameTh: 'ที่ขูดขอบ', cat: 'tools', emoji: '🔧', priceMin: 90, priceMax: 180 },
  { name: 'File Set', nameTh: 'ชุดตะไบ', cat: 'tools', emoji: '🔧', priceMin: 120, priceMax: 320 },
  { name: 'Plastic Glue', nameTh: 'กาวพลาสติก', cat: 'glue', emoji: '🧲', priceMin: 80, priceMax: 180 },
  { name: 'Super Glue', nameTh: 'ซุปเปอร์กาว', cat: 'glue', emoji: '🧲', priceMin: 60, priceMax: 150 },
  { name: 'Spray Primer Grey', nameTh: 'สเปรย์รองพื้นเทา', cat: 'primer', emoji: '💨', priceMin: 250, priceMax: 450 },
  { name: 'Spray Primer Black', nameTh: 'สเปรย์รองพื้นดำ', cat: 'primer', emoji: '💨', priceMin: 250, priceMax: 450 },
  { name: 'Spray Primer White', nameTh: 'สเปรย์รองพื้นขาว', cat: 'primer', emoji: '💨', priceMin: 250, priceMax: 450 },
  { name: 'Brush Set Fine', nameTh: 'ชุดแปรงละเอียด', cat: 'brush', emoji: '🖌️', priceMin: 180, priceMax: 650 },
  { name: 'Painting Handle', nameTh: 'ที่จับโมเดลสำหรับทาสี', cat: 'tools', emoji: '🔧', priceMin: 120, priceMax: 280 },
  { name: 'Wet Palette', nameTh: 'เวทพาเลต', cat: 'tools', emoji: '🎨', priceMin: 180, priceMax: 450 },
  { name: 'Cutting Mat A4', nameTh: 'แผ่นตัด A4', cat: 'tools', emoji: '📐', priceMin: 90, priceMax: 220 },
  { name: 'Clippers', nameTh: 'คีมตัด', cat: 'tools', emoji: '✂️', priceMin: 200, priceMax: 850 },
  { name: 'Pinvise Drill', nameTh: 'สว่านมือ', cat: 'tools', emoji: '🔩', priceMin: 150, priceMax: 380 },
  { name: 'Basing Kit', nameTh: 'ชุดทำฐาน', cat: 'basing', emoji: '🪨', priceMin: 180, priceMax: 380 },
  { name: 'Static Grass', nameTh: 'หญ้าสำหรับตกแต่ง', cat: 'basing', emoji: '🌿', priceMin: 80, priceMax: 200 },
  { name: 'Basing Sand', nameTh: 'ทรายตกแต่งฐาน', cat: 'basing', emoji: '🪨', priceMin: 60, priceMax: 150 },
  { name: 'Painting Station', nameTh: 'โต๊ะทาสีแบบพกพา', cat: 'tools', emoji: '🎨', priceMin: 350, priceMax: 950 },
  { name: 'Magnifying Glass', nameTh: 'แว่นขยาย', cat: 'tools', emoji: '🔍', priceMin: 120, priceMax: 650 },
]

// ── Generate Products ──────────────────────────────────────────
async function generateProducts() {
  const products = []

  // ── MTG Singles: 800 cards ──────────────────────────────────
  const mtgPool = [...MTG_CREATURES, ...MTG_SPELLS, ...MTG_LANDS, ...MTG_PLANESWALKERS]
  for (let i = 0; i < 800; i++) {
    const baseName = pick(mtgPool)
    const set = pick(MTG_SETS)
    const rarity = pick(MTG_RARITIES)
    const condition = pick(MTG_CONDITIONS)
    const isFoil = Math.random() < 0.15
    const isBorderless = Math.random() < 0.08
    const isExtArt = Math.random() < 0.1
    const suffix = isFoil ? ' (Foil)' : isExtArt ? ' (Extended Art)' : isBorderless ? ' (Borderless)' : ''
    const name = `${baseName}${suffix}`

    const basePrice = rarity === 'M'
      ? price(500, 8000, 50)
      : rarity === 'R'
      ? price(50, 1500, 10)
      : rarity === 'U'
      ? price(10, 150, 5)
      : price(5, 50, 5)

    const adjustedPrice = (isFoil ? basePrice * 1.5 : basePrice) | 0
    const roundedPrice = Math.ceil(adjustedPrice / 10) * 10

    products.push({
      name,
      nameTh: null,
      description: `${name} จาก ${set} — Condition: ${condition}`,
      price: roundedPrice,
      stock: rand(0, 8),
      condition,
      setName: set,
      emoji: pick(MTG_EMOJIS),
      imageUrl: null,
      isNew: Math.random() < 0.12,
      isActive: Math.random() < 0.95,
      categoryId: CAT.mtgSingle,
      rarity,
      colors: pick(MTG_COLORS),
      formats: pick(MTG_FORMATS),
      cardType: pick(MTG_TYPES),
      sealedCat: null,
      rbRarity: null,
      rbType: null,
      rbSealedCat: null,
      paintCat: null,
    })
  }

  // ── MTG Sealed: 300 products ───────────────────────────────
  for (let i = 0; i < 300; i++) {
    const template = pick(SEALED_PRODUCTS)
    const set = pick(MTG_SETS)
    const name = `${set} — ${template.name}`
    const nameTh = `${set} ${template.nameTh}`

    products.push({
      name,
      nameTh,
      description: `${template.name} ของ ${set}`,
      price: price(template.priceMin, template.priceMax, 50),
      stock: rand(0, 20),
      condition: 'SEALED',
      setName: set,
      emoji: template.emoji,
      imageUrl: null,
      isNew: Math.random() < 0.2,
      isActive: Math.random() < 0.92,
      categoryId: CAT.mtgSealed,
      rarity: null,
      colors: null,
      formats: null,
      cardType: null,
      sealedCat: template.cat,
      rbRarity: null,
      rbType: null,
      rbSealedCat: null,
      paintCat: null,
    })
  }

  // ── Riftbound Singles: 400 cards ──────────────────────────
  for (let i = 0; i < 400; i++) {
    const baseName = pick(RB_CARDS)
    const set = pick(RB_SETS)
    const rarity = pick(RB_RARITIES_SINGLES)
    const type = pick(RB_TYPES_SINGLES)
    const isFoil = Math.random() < 0.12
    const name = `${baseName}${isFoil ? ' (Foil)' : ''}`

    const basePrice = rarity === 'Legendary'
      ? price(200, 2500, 50)
      : rarity === 'Epic'
      ? price(80, 800, 20)
      : rarity === 'Rare'
      ? price(30, 300, 10)
      : rarity === 'Uncommon'
      ? price(10, 80, 5)
      : price(5, 30, 5)

    products.push({
      name,
      nameTh: null,
      description: `${name} — ${rarity} ${type} จากเซ็ต ${set}`,
      price: isFoil ? Math.ceil(basePrice * 1.4 / 10) * 10 : basePrice,
      stock: rand(0, 15),
      condition: pick(['NM','NM','LP','MP']),
      setName: set,
      emoji: pick(RB_EMOJIS),
      imageUrl: null,
      isNew: Math.random() < 0.15,
      isActive: Math.random() < 0.93,
      categoryId: CAT.rbSingle,
      rarity: null,
      colors: null,
      formats: null,
      cardType: null,
      sealedCat: null,
      rbRarity: rarity,
      rbType: type,
      rbSealedCat: null,
      paintCat: null,
    })
  }

  // ── Riftbound Sealed: 150 products ────────────────────────
  for (let i = 0; i < 150; i++) {
    const template = pick(RB_SEALED_PRODUCTS)
    const set = pick(RB_SETS)
    const name = `${set} — ${template.name}`
    const basePrice = template.cat === 'box'
      ? price(1200, 3500, 100)
      : template.cat === 'elite'
      ? price(400, 1200, 50)
      : template.cat === 'starter'
      ? price(350, 800, 50)
      : price(80, 250, 10)

    products.push({
      name,
      nameTh: `${set} ${template.nameTh}`,
      description: `${template.nameTh} เซ็ต ${set}`,
      price: basePrice,
      stock: rand(0, 25),
      condition: 'SEALED',
      setName: set,
      emoji: template.emoji,
      imageUrl: null,
      isNew: Math.random() < 0.18,
      isActive: Math.random() < 0.9,
      categoryId: CAT.rbSealed,
      rarity: null,
      colors: null,
      formats: null,
      cardType: null,
      sealedCat: null,
      rbRarity: null,
      rbType: null,
      rbSealedCat: template.cat,
      paintCat: null,
    })
  }

  // ── Paints: 250 paints ────────────────────────────────────
  for (let i = 0; i < 250; i++) {
    const brand = pick(PAINT_BRANDS)
    const type = pick(PAINT_TYPES)
    const color = pick(PAINT_COLORS_LIST)
    const name = `${brand} — ${color} (${type})`
    const basePrice = type === 'Contrast'
      ? price(220, 320, 10)
      : type === 'Technical' || type === 'Texture'
      ? price(200, 350, 10)
      : type === 'Air'
      ? price(180, 280, 10)
      : price(150, 250, 10)

    products.push({
      name,
      nameTh: `${brand} ${color}`,
      description: `สี ${type} จาก ${brand} — ${color}`,
      price: basePrice,
      stock: rand(0, 30),
      condition: 'SEALED',
      setName: brand,
      emoji: pick(PAINT_EMOJIS),
      imageUrl: null,
      isNew: Math.random() < 0.08,
      isActive: Math.random() < 0.97,
      categoryId: CAT.paint,
      rarity: null,
      colors: null,
      formats: null,
      cardType: null,
      sealedCat: null,
      rbRarity: null,
      rbType: null,
      rbSealedCat: null,
      paintCat: type.toLowerCase(),
    })
  }

  // ── Model Tools: 100 items ────────────────────────────────
  for (let i = 0; i < 100; i++) {
    const template = pick(MODEL_TOOLS)
    const brand = pick(['Citadel','Vallejo','Army Painter','Tamiya','Revell','Woodland Scenics','Gaugemaster'])
    const name = `${brand} ${template.name}`

    products.push({
      name,
      nameTh: `${brand} ${template.nameTh}`,
      description: `${template.nameTh} ยี่ห้อ ${brand}`,
      price: price(template.priceMin, template.priceMax, 10),
      stock: rand(1, 25),
      condition: 'SEALED',
      setName: brand,
      emoji: template.emoji,
      imageUrl: null,
      isNew: Math.random() < 0.1,
      isActive: Math.random() < 0.95,
      categoryId: CAT.paint,
      rarity: null,
      colors: null,
      formats: null,
      cardType: null,
      sealedCat: null,
      rbRarity: null,
      rbType: null,
      rbSealedCat: null,
      paintCat: template.cat,
    })
  }

  return products
}

async function main() {
  console.log('🎲 Generating 2,000 products...')
  const products = await generateProducts()
  console.log(`📦 Generated ${products.length} products. Inserting...`)

  // Insert in batches of 100
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH)
    await prisma.product.createMany({ data: batch, skipDuplicates: true })
    inserted += batch.length
    process.stdout.write(`\r✅ Inserted ${inserted}/${products.length}`)
  }

  console.log('\n\n📊 Summary:')
  const counts = await prisma.product.groupBy({
    by: ['categoryId'],
    _count: { id: true },
  })
  for (const row of counts) {
    const entry = Object.entries(CAT).find(([, v]) => v === row.categoryId)
    console.log(`  ${entry?.[0] ?? row.categoryId}: ${row._count.id} products`)
  }

  console.log('\n🎉 Done!')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
