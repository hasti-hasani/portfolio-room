// ------------------------------------------------------------
// Your room's content. Edit this file only — no other code needed.
//
// - Leave a field as "" if you don't have it yet.
// - Images and 3D models: put the files in the "assets" folder and
//   write their path, e.g. "assets/dress-1.glb" or "assets/cert-1.jpg".
// - CLO3D: File > Export > glTF (.glb). Keep each file under ~15 MB.
// ------------------------------------------------------------

window.PORTFOLIO = {
  owner: "Your Name",
  tagline: "Fashion designer · HCI & AI",
  homeUrl: "#", // the door leads back here (your personal site)

  // The computer on the desk
  projects: [
    {
      title: "Style Discovery",
      year: "2026",
      summary: "An HCI case study on helping people discover their personal style. (Placeholder — replace with your summary.)",
      tags: ["HCI", "AI", "UX research"],
      link: "",
      image: "",
    },
    {
      title: "Project two",
      year: "2025",
      summary: "One or two sentences about the problem, your role, and the outcome.",
      tags: ["Interaction design"],
      link: "",
      image: "",
    },
  ],

  // The bookshelf
  articles: [
    {
      title: "Article on garment recycling",
      venue: "Journal / blog name",
      year: "2026",
      summary: "One sentence about what the article found.",
      link: "",
    },
    {
      title: "Second article",
      venue: "Medium",
      year: "2025",
      summary: "",
      link: "",
    },
  ],

  // The books you see on the shelves (decoration only — the articles above are what opens).
  // One list per shelf, top to bottom: "Title | Author". Add, remove or reorder freely.
  shelfBooks: [
    [ // Design
      "The Design of Everyday Things | Don Norman", "Thinking with Type | Ellen Lupton", "Interaction of Color | Josef Albers",
      "Grid Systems in Graphic Design | Josef Müller-Brockmann", "Universal Principles of Design | Lidwell, Holden, Butler",
      "Ways of Seeing | John Berger", "Design as Art | Bruno Munari", "Speculative Everything | Dunne & Raby",
      "Designing Design | Kenya Hara", "Emotional Design | Don Norman", "The Shape of Design | Frank Chimero",
      "Graphic Design: The New Basics | Lupton & Phillips",
    ],
    [ // HCI
      "Interaction Design | Rogers, Sharp, Preece", "About Face | Alan Cooper", "Research Methods in HCI | Lazar, Feng, Hochheiser",
      "Sketching User Experiences | Bill Buxton", "Human–Computer Interaction | Dix, Finlay, Abowd, Beale",
      "Designing Interactions | Bill Moggridge", "Where the Action Is | Paul Dourish", "Plans and Situated Actions | Lucy Suchman",
      "Observing the User Experience | Goodman, Kuniavsky, Moed", "Just Enough Research | Erika Hall",
      "Design Justice | Sasha Costanza-Chock", "Data Feminism | D'Ignazio & Klein", "Don't Make Me Think | Steve Krug",
    ],
    [ // Machine learning & AI
      "Deep Learning | Goodfellow, Bengio, Courville", "Pattern Recognition and Machine Learning | Christopher Bishop",
      "Artificial Intelligence: A Modern Approach | Russell & Norvig", "Hands-On Machine Learning | Aurélien Géron",
      "The Elements of Statistical Learning | Hastie, Tibshirani, Friedman", "Designing Machine Learning Systems | Chip Huyen",
      "Reinforcement Learning | Sutton & Barto", "Speech and Language Processing | Jurafsky & Martin",
      "Interpretable Machine Learning | Christoph Molnar", "Atlas of AI | Kate Crawford", "Weapons of Math Destruction | Cathy O'Neil",
      "The Alignment Problem | Brian Christian", "Human Compatible | Stuart Russell",
    ],
    [ // Fashion
      "Sustainable Fashion and Textiles | Kate Fletcher", "Zero Waste Fashion Design | Rissanen & McQuillan",
      "Patternmaking for Fashion Design | Helen Joseph-Armstrong", "Draping: The Complete Course | Karolyn Kiisel",
      "Fashion Design | Sue Jenkyn Jones", "The Fashion System | Roland Barthes", "Fashionopolis | Dana Thomas",
      "Craft of Use | Kate Fletcher", "Overdressed | Elizabeth L. Cline", "Fashion & Sustainability | Fletcher & Grose",
      "Textiles: The Whole Story | Beverly Gordon", "Pattern Cutting | Dennic Chunman Lo",
    ],
  ],

  // The frames above the desk (the first three appear on the wall)
  certificates: [
    { title: "Certificate one", issuer: "Issuer", year: "2025", image: "" },
    { title: "Certificate two", issuer: "Issuer", year: "2024", image: "" },
    { title: "Certificate three", issuer: "Issuer", year: "2023", image: "" },
  ],

  // The pin board beside the bookshelf: HCI on the left, machine learning on the right.
  // Decoration only (not clickable): the first three titles of each list are written on its notes.
  board: {
    hci: [
      { title: "User interviews", year: "2026", summary: "What you studied, who took part, what you learned.", tags: ["Research"], link: "" },
      { title: "Prototype testing", year: "2026", summary: "", tags: ["Usability"], link: "" },
      { title: "Design principles", year: "2025", summary: "", tags: [], link: "" },
    ],
    ml: [
      { title: "Style recommender", year: "2026", summary: "The model, the data, and how people used it.", tags: ["Recommender"], link: "" },
      { title: "Dataset notes", year: "2026", summary: "", tags: ["Data"], link: "" },
      { title: "Model experiments", year: "2025", summary: "", tags: [], link: "" },
    ],
  },

  // The clothing rack — CLO3D garments. "color" tints the dress on each hanger.
  garments: [
    { title: "Garment one", year: "2026", summary: "Fabric, technique, idea.", model: "", image: "", color: "#e8b9b5" },
    { title: "Garment two", year: "2025", summary: "", model: "", image: "", color: "#b7cbb0" },
    { title: "Garment three", year: "2025", summary: "", model: "", image: "", color: "#c2d6e2" },
  ],

  // Shown only when someone clicks a painting, or the little label on the corner of the rug
  artworks: {
    stillLife: {
      title: "Bahman Mohassess",
      meta: "1931–2010 · Rasht, Iran",
      image: "assets/art/still-life-fish.webp",
      text: "Iranian modernist painter and sculptor. His work is known for distorted human figures, mythical creatures and surreal imagery that explore human existence, alienation and suffering. He was also a translator and theatre director. Though censorship and destruction claimed many of his works, he remains one of the most influential figures in modern Iranian art.",
    },
    mask: {
      title: "Mansour Ghandriz",
      meta: "1936–1966 · Tabriz, Iran",
      image: "assets/art/mask.webp",
      text: "Iranian modernist painter and one of the pioneers of the Saqqakhaneh movement, which joined traditional Iranian art and cultural symbols with modern styles. His paintings bring together abstract geometric forms, mythical figures and motifs from Persian art and folklore.",
    },
    sadeghi: {
      title: "Ali Akbar Sadeghi",
      meta: "Painter and illustrator · b. 1937, Tehran, Iran",
      image: "assets/art/sadeghi.webp",
      text: "Known for surreal, densely detailed illustrations rooted in Persian miniatures, coffeehouse painting and literature, at times reworking Western works such as Munch's The Scream. One of Iran's most prolific artists, he won many awards for his illustration and animation and was named one of “Iran's Enduring Faces” in 1999.",
    },
    rug: {
      title: "Silk Kashan Carpet",
      meta: "Kashan, Iran · Safavid period, 16th century",
      image: "assets/rug/silk_kashan_carpet_met.webp",
      text: "Woven in silk in Kashan under the Safavid dynasty, when the city's workshops made some of the finest carpets in the world for the royal court. The original is in the collection of The Metropolitan Museum of Art, New York.",
    },
  },
};
