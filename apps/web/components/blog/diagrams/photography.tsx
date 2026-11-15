import { Drawing, defineDiagram, Label, LINE, SHAPE, SOFT } from './kit';

// Guide: product-photography-for-ecommerce.

/** The setup seen from above: window at about 45 degrees, white board opposite, tripod in front. */
export const windowLightSetup = defineDiagram(
  {
    en: {
      window: ['Window,', 'no direct sun'],
      board: ['White', 'foam board'],
      product: 'Product',
      camera: ['Phone on a tripod', 'at middle height'],
      angle: '45°',
      ceiling: 'Ceiling lights off',
      bounce: 'bounce',
    },
    de: {
      window: ['Fenster,', 'ohne direkte Sonne'],
      board: ['Weiße', 'Schaumstoffplatte'],
      product: 'Produkt',
      camera: ['Handy auf dem Stativ', 'auf halber Höhe'],
      angle: '45°',
      ceiling: 'Deckenlicht aus',
      bounce: 'Aufheller',
    },
    fr: {
      window: ['Fenêtre,', 'sans soleil direct'],
      board: ['Carton plume', 'blanc'],
      product: 'Produit',
      camera: ['Téléphone sur trépied', 'à mi-hauteur'],
      angle: '45°',
      ceiling: 'Plafonnier éteint',
      bounce: 'rebond',
    },
  },
  function WindowLightSetup({ t }) {
    // Product centred at (300, 190). The window sits front-left of it, 45 degrees off the axis
    // from the product to the camera, which points straight down the drawing.
    return (
      <Drawing viewBox="0 0 560 460">
        <defs>
          <marker
            id="wls-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {/* Ceiling light, switched off. */}
        <circle cx={58} cy={50} r={20} className={SOFT} strokeWidth={2} />
        <line x1={44} y1={36} x2={72} y2={64} className={LINE} strokeWidth={3} />
        <line x1={72} y1={36} x2={44} y2={64} className={LINE} strokeWidth={3} />
        <Label x={90} y={58}>
          {t.ceiling}
        </Label>
        {/* The product, from above. */}
        <Label x={300} y={130} textAnchor="middle">
          {t.product}
        </Label>
        <rect x={252} y={142} width={96} height={96} rx={18} className={SHAPE} strokeWidth={2} />
        {/* Window and its soft light. */}
        <line x1={113} y1={271} x2={219} y2={377} className={LINE} strokeWidth={5} />
        {[
          [136, 294, 226, 204],
          [166, 324, 250, 240],
          [196, 354, 278, 272],
        ].map(([x1, y1, x2, y2]) => (
          <line
            key={`${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={SOFT}
            strokeWidth={2}
            strokeDasharray="6 6"
            markerEnd="url(#wls-arrow)"
          />
        ))}
        <Label x={20} y={222}>
          {t.window[0]}
        </Label>
        <Label x={20} y={250} isMuted fontSize={22}>
          {t.window[1]}
        </Label>
        {/* Camera axis and the angle between it and the window. */}
        <line
          x1={300}
          y1={240}
          x2={300}
          y2={372}
          className={SOFT}
          strokeWidth={2}
          strokeDasharray="2 6"
        />
        <path d="M300 300 A 110 110 0 0 1 222.2 267.8" className={LINE} strokeWidth={2} />
        <Label x={250} y={334} isMuted>
          {t.angle}
        </Label>
        {/* White board on the far side, bouncing light into the shadow side. */}
        <rect
          x={470}
          y={118}
          width={18}
          height={150}
          className="fill-background stroke-foreground"
          strokeWidth={2}
        />
        <line
          x1={462}
          y1={196}
          x2={356}
          y2={196}
          className={SOFT}
          strokeWidth={2}
          strokeDasharray="6 6"
          markerEnd="url(#wls-arrow)"
        />
        <Label x={408} y={180} textAnchor="middle" isMuted fontSize={22}>
          {t.bounce}
        </Label>
        <Label x={479} y={300} textAnchor="middle">
          {t.board[0]}
        </Label>
        <Label x={479} y={328} textAnchor="middle">
          {t.board[1]}
        </Label>
        {/* Phone on its tripod, from above. */}
        <rect x={282} y={376} width={36} height={18} rx={4} className={SHAPE} strokeWidth={2} />
        {[
          [300, 394, 272, 430],
          [300, 394, 328, 430],
          [300, 394, 300, 438],
        ].map(([x1, y1, x2, y2]) => (
          <line
            key={`${x2}-${y2}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={LINE}
            strokeWidth={2}
          />
        ))}
        <Label x={340} y={400}>
          {t.camera[0]}
        </Label>
        <Label x={340} y={428} isMuted fontSize={22}>
          {t.camera[1]}
        </Label>
      </Drawing>
    );
  },
);

/** The same sideboard from two camera heights: level at its middle, or looking down from eye level. */
export const cameraHeight = defineDiagram(
  {
    en: {
      level: ['Middle height:', 'true proportions'],
      high: ['Standing height:', 'short and squat'],
      floor: 'Floor',
    },
    de: {
      level: ['Halbe Höhe:', 'echte Proportionen'],
      high: ['Augenhöhe:', 'kurz und gedrungen'],
      floor: 'Boden',
    },
    fr: {
      level: ['À mi-hauteur :', 'vraies proportions'],
      high: ['Debout :', 'court et trapu'],
      floor: 'Sol',
    },
  },
  function CameraHeight({ t }) {
    return (
      <Drawing viewBox="0 0 560 360">
        {/* Floor. */}
        <line x1={20} y1={300} x2={540} y2={300} className={SOFT} strokeWidth={2} />
        <Label x={540} y={332} textAnchor="end" isMuted fontSize={22}>
          {t.floor}
        </Label>
        {/* The sideboard, from the side: body on short legs. */}
        <rect x={380} y={196} width={130} height={82} rx={4} className={SHAPE} strokeWidth={2} />
        <line x1={392} y1={278} x2={392} y2={300} className={LINE} strokeWidth={3} />
        <line x1={498} y1={278} x2={498} y2={300} className={LINE} strokeWidth={3} />
        {/* Camera at the piece's middle height, looking level. */}
        <rect x={40} y={224} width={40} height={26} rx={5} className={SHAPE} strokeWidth={2} />
        <line x1={60} y1={250} x2={60} y2={300} className={LINE} strokeWidth={2} />
        <line x1={84} y1={237} x2={372} y2={237} className={LINE} strokeWidth={2} />
        <Label x={96} y={196}>
          {t.level[0]}
        </Label>
        <Label x={96} y={224} isMuted>
          {t.level[1]}
        </Label>
        {/* Camera at standing eye height, looking down at the top. */}
        <rect x={40} y={48} width={40} height={26} rx={5} className={SHAPE} strokeWidth={2} />
        <line x1={60} y1={74} x2={60} y2={300} className={SOFT} strokeWidth={2} />
        <line
          x1={84}
          y1={66}
          x2={372}
          y2={218}
          className={SOFT}
          strokeWidth={2}
          strokeDasharray="8 7"
        />
        <Label x={96} y={34}>
          {t.high[0]}
        </Label>
        <Label x={96} y={62} isMuted>
          {t.high[1]}
        </Label>
      </Drawing>
    );
  },
);

/** The same side table through a wide lens used close, and a 2x or 3x lens from further back. */
export const lensDistance = defineDiagram(
  {
    en: {
      close: ['1x lens, close', 'Front legs look longer'],
      far: ['2x or 3x, back', 'Legs look even'],
    },
    de: {
      close: ['Objektiv 1x, nah', 'Vordere Beine länger'],
      far: ['2x oder 3x, weiter', 'Beine wirken gleich'],
    },
    fr: {
      close: ['Objectif 1x, de près', 'Pieds avant allongés'],
      far: ['2x ou 3x, en retrait', 'Pieds réguliers'],
    },
  },
  function LensDistance({ t }) {
    // A side table seen slightly from above. `taper` narrows the far edge of the top and `back`
    // shortens the far legs: both grow when the camera is close to the table. The far legs are
    // drawn first, so the top hides where they meet it.
    const table = (x: number, taper: number, front: number, back: number) => {
      const top = 70;
      const near = top + 36;
      return (
        <g transform={`translate(${x} 0)`}>
          <line
            x1={36 + taper}
            y1={top + 4}
            x2={36 + taper}
            y2={top + back}
            className={SOFT}
            strokeWidth={3}
          />
          <line
            x1={204 - taper}
            y1={top + 4}
            x2={204 - taper}
            y2={top + back}
            className={SOFT}
            strokeWidth={3}
          />
          <path
            d={`M${30 + taper} ${top} L${210 - taper} ${top} L210 ${near} L30 ${near} Z`}
            className={SHAPE}
            strokeWidth={2}
          />
          <line x1={36} y1={near} x2={36} y2={near + front} className={LINE} strokeWidth={4} />
          <line x1={204} y1={near} x2={204} y2={near + front} className={LINE} strokeWidth={4} />
        </g>
      );
    };
    return (
      <Drawing viewBox="0 0 560 300">
        {table(12, 44, 120, 58)}
        {table(310, 12, 98, 94)}
        {[
          { x: 132, copy: t.close },
          { x: 430, copy: t.far },
        ].map((panel) => (
          <g key={panel.x}>
            <Label x={panel.x} y={40} textAnchor="middle" fontWeight={600}>
              {panel.copy[0]}
            </Label>
            <Label x={panel.x} y={276} textAnchor="middle" isMuted fontSize={22}>
              {panel.copy[1]}
            </Label>
          </g>
        ))}
      </Drawing>
    );
  },
);
