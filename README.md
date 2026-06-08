# Thuisbatterij Calculator

Een eenvoudige, volledig client-side webapp die Nederlandse consumenten helpt bepalen welke thuisbatterij het beste past bij hun eigen stroomverbruik en zonne-energieopbrengst.

Laad een of meerdere energiedata-exports (P1-meter, energieleverancier), kies een of meer kandidaat-batterijen, en vergelijk hoeveel energie elke batterij van het net naar eigen verbruik zou hebben verschoven over de gekozen periode.

**Je data blijft op je eigen apparaat — open je netwerktabblad en je ziet 0 verzoeken na het laden.**

---

## Privacy

### Belofte

Deze app verstuurt nooit data naar een externe server. Alle CSV-bestanden worden volledig in de browser verwerkt. Er zijn geen analytics, geen trackers, geen foutrapportage-diensten (geen Sentry, Rollbar, of Bugsnag), en geen externe lettertypen of scripts.

De Content Security Policy legt dit mechanisch vast: `connect-src 'none'` verhindert elke uitgaande verbinding vanuit de browser.

### Verifieer het zelf

Wil je de privacybelofte zelf controleren? Zo doe je dat:

1. Open de app in een nieuw incognitovenster.
2. Open de browser-ontwikkelaarstools (F12 of Cmd+Option+I).
3. Ga naar het tabblad **Netwerk** (Network).
4. Laad de pagina opnieuw.
5. Controleer na het laden: er mogen **nul** verzoeken naar externe domeinen zijn. Alleen de eigen bestanden van de app zijn zichtbaar (de pagina zelf en de assets onder `/battery-calculator/assets/`).

> **Opmerking over `frame-ancestors`:** De Content Security Policy bevat `frame-ancestors 'none'` ter documentatie van de intentie, maar browsers negeren dit in `<meta>`-tags. GitHub Pages biedt geen HTTP-headers; dit is een bekende beperking van statische hosting.

---

## Lokale ontwikkeling

Vereisten: Node.js LTS (22.x), npm.

```bash
# Installeer afhankelijkheden
npm install

# Start de ontwikkelserver (zonder CSP — HMR werkt)
npm run dev

# Bouw de productieversie (met CSP geïnjecteerd door Vite-plugin)
npm run build

# Voer de testsuite uit
npm test

# Controleer op lintfouten
npm run lint

# Controleer opmaak
npm run format:check
```

---

## Deployment

De app wordt automatisch uitgerold via GitHub Actions naar GitHub Pages bij elke push naar `main`.

De CI-job (`ci`) voert eerst de volgende stappen uit:

- `npm run build` — bouw de statische output
- `npm run lint` — ESLint op de TypeScript-broncode
- `npm run format:check` — Prettier-opmaakcontrole
- `npm test` — Vitest-testsuite
- **Privacy guard** — scant `dist/` op externe `https://`-URLs en breekt de build af als er een gevonden wordt (D-04)
- **Geen foutrapportage-bibliotheekcheck** — controleert of `sentry`, `rollbar` of `bugsnag` in `package.json` staan (PRIV-03)

De deploy-job (`deploy`) start alleen als `ci` succesvol is (`needs: ci`). Een gebroken push bereikt Pages nooit.

### Vereiste eenmalige instelling

Voordat de eerste automatische deploy werkt, moet de GitHub Pages-bron ingesteld worden:

**GitHub repo → Settings → Pages → Build and deployment → Source → kies "GitHub Actions"**

> **Belangrijk — niet de standaardinstelling.** GitHub Pages staat standaard ingesteld op
> de "Deploy from a branch"-modus (legacy). Laat je die instelling staan, dan serveert
> GitHub Pages de ongebouwde repo-root — inclusief de broncode `index.html` die verwijst
> naar `/src/main.ts` (een 404 op een statische host zonder Vite dev-server om TypeScript
> te transpileren) en **zonder** de stylesheet die alleen door `vite build` naar `dist/`
> wordt geschreven. De pagina laadt dan zonder opmaak en met een JavaScript-fout. Het
> deploy-artifact van de Actions-workflow wordt in die modus stilzwijgend genegeerd.
>
> Door Source in te stellen op **"GitHub Actions"** gebruikt GitHub Pages het
> `dist/`-artifact dat de CI-workflow bouwt en uploadt — precies zoals bedoeld.

---

## Beveiliging

- **Content Security Policy:** De productie-`index.html` bevat een strikte CSP via een Vite-buildplugin (`apply: 'build'`). De broncode bevat geen CSP-metatag zodat HMR tijdens ontwikkeling werkt.
- **Geen inline scripts of stijlen:** `script-src 'self'` en `style-src 'self'` — geen CDN, geen externe bronnen.
- **Lettertypen:** Uitsluitend systeemlettertypen (`font-src 'self'`); geen Google Fonts of CDN-lettertypen.
- **`frame-ancestors 'none'` (advisoir):** Opgenomen in de CSP als intentie-documentatie; wordt genegeerd in `<meta>`-tags door browsers. GitHub Pages biedt geen HTTP-headers.

---

## Technologie

- **Vite 8** — bundler en dev-server
- **TypeScript ~5.6** — typesysteem
- **Vanilla DOM + `@preact/signals-core`** — geen framework
- **Vitest 4.1** — tests
- **GitHub Actions + GitHub Pages** — CI/CD en hosting
