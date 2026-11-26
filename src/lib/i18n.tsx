"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";

export type Lang = "en" | "am";

export const LANG_LABEL: Record<Lang, string> = { en: "English", am: "አማርኛ" };

/**
 * Storefront copy in English and Amharic. Product names, categories and other
 * owner-entered text stay as typed — only the interface language switches.
 */
export const DICT: Record<string, { en: string; am: string }> = {
  // ---------- navigation / chrome ----------
  "nav.shop": { en: "Shop", am: "ሱቅ" },
  "nav.lookbook": { en: "Lookbook", am: "ሉክቡክ" },
  "nav.studio": { en: "The Studio", am: "ስቱዲዮ" },
  "nav.saved": { en: "Saved", am: "የተቀመጡ" },
  "nav.account": { en: "Account", am: "አካውንት" },
  "nav.signIn": { en: "Sign in", am: "ይግቡ" },
  "nav.signOut": { en: "Out", am: "ውጣ" },
  "nav.bag": { en: "Bag", am: "ቦርሳ" },
  "nav.menu": { en: "Menu", am: "ዝርዝር" },
  "nav.close": { en: "Close", am: "ዝጋ" },
  "lang.toggle": { en: "አማ", am: "EN" },
  "lang.switchTo": { en: "Switch to Amharic", am: "ወደ እንግሊዝኛ ይቀይሩ" },

  // ---------- footer ----------
  "footer.line1": { en: "Worn out,", am: "ያረጀ፣" },
  "footer.line2": { en: "not worn off.", am: "አልተጨረሰም።" },
  "footer.blurb": {
    en: "Independent cloth maker. Every piece is cut, sewn and finished by one pair of hands.",
    am: "ገለልተኛ የጨርቅ ሰሪ። እያንዳንዱ ልብስ በአንድ ጥንድ እጅ ተቆርጦ፣ ተሰፍቶ ይጠናቀቃል።",
  },
  "footer.shop": { en: "Shop", am: "ሱቅ" },
  "footer.allGarments": { en: "All garments", am: "ሁሉም ልብሶች" },
  "footer.savedItems": { en: "Saved items", am: "የተቀመጡ ዕቃዎች" },
  "footer.support": { en: "Support", am: "ድጋፍ" },
  "footer.trackOrder": { en: "Track an order", am: "ትዕዛዝ ይከታተሉ" },
  "footer.yourAccount": { en: "Your account", am: "የእርስዎ አካውንት" },
  "footer.care": { en: "Garment care", am: "የልብስ እንክብካቤ" },
  "footer.shipping": { en: "Shipping & returns", am: "ማድረስና ተመላሽ" },
  "footer.boring": { en: "The boring bits", am: "ትንንሽ ዝርዝሮች" },
  "footer.boringBody": {
    en: "Payments are made by bank transfer through our payment link and verified by a human — usually within a few hours. No cards, no middlemen.",
    am: "ክፍያ በባንክ ዝውውር በኩል ይፈጸማል እና በሰው ይረጋገጣል — አብዛኛውን ጊዜ በጥቂት ሰዓታት ውስጥ። ካርድ የለም፣ ደላላ የለም።",
  },
  "footer.rights": { en: "JO Studio — Cut & sewn with intent", am: "JO ስቱዲዮ — በትኩረት ተቆርጦና ተሰፍቶ" },

  // ---------- home ----------
  "home.heroA": { en: "Cloth,", am: "ጨርቅ፣" },
  "home.heroB": { en: "made to be", am: "ለመልበስ" },
  "home.heroC": { en: "worn out.", am: "የተሰራ።" },
  "home.kicker": {
    en: "Independent cloth maker — Est. in a garage, worn everywhere",
    am: "ገለልተኛ የጨርቅ ሰሪ — በጋራዥ ተጀመረ፣ በሁሉም ቦታ ይለበሳል",
  },
  "home.scroll": { en: "Scroll", am: "ወደታች" },
  "home.manifestoA": {
    en: "One pair of hands. A single Juki. Fabric sourced in small lots and cut like it matters — ",
    am: "አንድ ጥንድ እጅ። አንድ Juki። ጨርቅ በትንሽ መጠን ተገዝቶ፣ ትኩረት ሰጥቶ ይቆረጣል — ",
  },
  "home.manifestoAccent": { en: "because it does.", am: "ምክንያቱም ይገባዋል።" },
  "home.manifestoBody": {
    en: "JO is not a brand with a factory. It's a cloth maker with a waiting list. Every garment is numbered, signed inside the hem, and built to outlive the trend that bought it.",
    am: "JO ፋብሪካ ያለው ብራንድ አይደለም። ተራ የሚጠብቁ ደንበኞች ያሉት የጨርቅ ሰሪ ነው። እያንዳንዱ ልብስ ቁጥር ተሰጥቶታል፣ ከጫፉ ስር ፊርማ አለው፣ እና የገዛውን ፋሽን አልፎ እንዲኖር ተሰርቷል።",
  },
  "home.latest": { en: "Latest drop", am: "አዲስ የወጣ" },
  "home.viewAll": { en: "View all →", am: "ሁሉንም ይመልከቱ →" },
  "home.album": { en: "The album — straight from the bench", am: "አልበሙ — ከወርክሾፑ በቀጥታ" },
  "home.process": { en: "How a JO happens", am: "አንድ JO እንዴት ይሰራል" },
  "home.step1": { en: "Sourced", am: "የተገኘ" },
  "home.step1Body": {
    en: "Deadstock and small-lot fabric, bought once. When it's gone, it's gone — most pieces never repeat.",
    am: "የቀረ እና በትንሽ መጠን የተገኘ ጨርቅ፣ አንድ ጊዜ ብቻ ይገዛል። ሲያልቅ ያልቃል — አብዛኞቹ ዕቃዎች አይደገሙም።",
  },
  "home.step2": { en: "Cut & sewn", am: "ተቆርጦና ተሰፍቶ" },
  "home.step2Body": {
    en: "One pattern cutter, one machinist, zero rush. A jacket takes two days. That's the point.",
    am: "አንድ የስርዓተ ቅርጽ ቆራጭ፣ አንድ ሰፊ፣ ምንም ግድፈት። ጃኬት ሁለት ቀን ይወስዳል። ዋናው ነጥብ ይኸው ነው።",
  },
  "home.step3": { en: "Numbered", am: "የተቆጠረ" },
  "home.step3Body": {
    en: "Every piece is signed and numbered inside the hem. Yours is the only one like it.",
    am: "እያንዳንዱ ዕቃ ከጫፉ ስር ፊርማና ቁጥር አለው። የእርስዎ ብቸኛው ነው።",
  },
  "home.shopDrop": { en: "Shop the drop", am: "የወጣውን ይግዙ" },

  // ---------- shop ----------
  "shop.title": { en: "The rack", am: "መደርደሪያው" },
  "shop.category": { en: "Category", am: "ምድብ" },
  "shop.allPieces": { en: "All pieces", am: "ሁሉም ዕቃዎች" },
  "shop.max": { en: "Max", am: "ከፍተኛ" },
  "shop.any": { en: "any", am: "ሁሉም" },
  "shop.sortNew": { en: "Newest", am: "አዲስ" },
  "shop.count": { en: "{n} pieces", am: "{n} ዕቃዎች" },
  "shop.countOne": { en: "{n} piece", am: "{n} ዕቃ" },
  "shop.loading": { en: "Loading", am: "በመጫን ላይ" },
  "shop.errorTitle": { en: "Rack unavailable", am: "መደርደሪያው አይገኝም" },
  "shop.errorBody": {
    en: "The rack could not be loaded. Please refresh in a moment.",
    am: "መደርደሪያው ሊጫን አልቻለም። እባክዎ ትንሽ ቆይተው ያድሱ።",
  },
  "shop.retry": { en: "Try again", am: "እንደገና ይሞክሩ" },
  "shop.emptyTitle": { en: "Nothing here yet", am: "እስካሁን ምንም የለም" },
  "shop.emptyBody": {
    en: "Jo hasn't hung anything in this corner. Check the full rack.",
    am: "Jo በዚህ ጥግ ምንም አልሰቀለም። ሙሉውን መደርደሪያ ይመልከቱ።",
  },

  // ---------- product card ----------
  "card.soldOut": { en: "Sold out", am: "አልቋል" },
  "card.left": { en: "Only {n} left", am: "{n} ብቻ ቀርቷል" },

  // ---------- product page ----------
  "product.notFound": { en: "Piece not found", am: "ዕቃው አልተገኘም" },
  "product.notFoundBody": { en: "It may have sold out and been retired.", am: "ሊሆን ይችላል አልቆ ከሽያጭ ተወግዷል።" },
  "product.backToRack": { en: "← Back to the rack", am: "← ወደ መደርደሪያው" },
  "product.addToBag": { en: "Add to bag", am: "ወደ ቦርሳ ጨምር" },
  "product.soldOut": { en: "Sold out", am: "አልቋል" },
  "product.colour": { en: "Colour", am: "ቀለም" },
  "product.size": { en: "Size", am: "መጠን" },
  "product.inStock": { en: "In stock", am: "በመጋዘን አለ" },
  "product.onlyLeft": { en: "Only {n} left in {size}", am: "በ{size} ውስጥ {n} ብቻ ቀርቷል" },
  "product.sizeSoldOut": { en: "Selected size sold out", am: "የመረጡት መጠን አልቋል" },
  "product.bagged": { en: "is in your bag", am: "በቦርሳዎ ውስጥ ነው" },
  "product.viewBag": { en: "View bag →", am: "ቦርሳ ይመልከቱ →" },
  "product.checkoutNow": { en: "Checkout now →", am: "አሁን ይክፈሉ →" },
  "product.save": { en: "Save", am: "አስቀምጥ" },
  "product.saved": { en: "Saved", am: "ተቀምጧል" },
  "product.payNote": {
    en: "Paid by bank transfer through Jo's payment link. Every payment is checked by a human before your piece ships — usually within hours.",
    am: "ክፍያ በባንክ ዝውውር በJo የክፍያ ሊንክ ይፈጸማል። ዕቃዎ ከመላኩ በፊት እያንዳንዱ ክፍያ በሰው ይረጋገጣል — አብዛኛውን ጊዜ በጥቂት ሰዓታት ውስጥ።",
  },
  "product.fabric": { en: "Fabric", am: "ጨርቅ" },
  "product.care": { en: "Care", am: "እንክብካቤ" },
  "product.shipping": { en: "Shipping", am: "ማድረስ" },
  "product.shippingBody": {
    en: "Worldwide flat-rate. Free over {amount}. Dispatched within 2 working days of payment verification.",
    am: "በዓለም አቀፍ ቋሚ ዋጋ። ከ{amount} በላይ ነጻ። ክፍያ ከተረጋገጠ በ2 የስራ ቀናት ውስጥ ይላካል።",
  },
  "product.wearsWellWith": { en: "Wears well with", am: "ከዚህ ጋር ይሰራል" },

  // ---------- cart ----------
  "cart.emptyTitle": { en: "Your bag is empty", am: "ቦርሳዎ ባዶ ነው" },
  "cart.emptyBody": {
    en: "Nothing folded in yet. The rack is full though.",
    am: "እስካሁን ምንም አልተቀመጠም። መደርደሪያው ግን ሞልቷል።",
  },
  "cart.title": { en: "Your bag", am: "ቦርሳዎ" },
  "cart.remove": { en: "Remove", am: "አስወግድ" },
  "cart.summary": { en: "Summary", am: "ማጠቃለያ" },
  "cart.subtotal": { en: "Subtotal", am: "ንዑስ ድምር" },
  "cart.shipping": { en: "Shipping", am: "ማድረስ" },
  "cart.free": { en: "Free", am: "ነጻ" },
  "cart.total": { en: "Total", am: "ጠቅላላ" },
  "cart.freeShipLeft": { en: "Add {amount} more for free shipping.", am: "ለነጻ ማድረስ {amount} ይቀራል።" },
  "cart.checkout": { en: "Checkout — bank transfer", am: "ወደ ክፍያ — በባንክ ዝውውር" },
  "cart.note": {
    en: "You'll pay via Jo's payment link and upload your bank receipt. Your order ships once a human verifies it.",
    am: "በJo የክፍያ ሊንክ ይከፍላሉ እና የባንክ ደረሰኝዎን ይስቀላሉ። ሰው ካረጋገጠ በኋላ ትዕዛዝዎ ይላካል።",
  },
  "cart.keepBrowsing": { en: "← Keep browsing", am: "← ግዢውን ይቀጥሉ" },

  // ---------- checkout ----------
  "co.step1": { en: "Details", am: "ዝርዝሮች" },
  "co.step2": { en: "Pay & prove", am: "ይክፈሉ እና ያረጋግጡ" },
  "co.step3": { en: "Done", am: "ተጠናቅቋል" },
  "co.nothingTitle": { en: "Nothing to check out", am: "የሚከፈል ነገር የለም" },
  "co.whereGoing": { en: "Where it's going", am: "የሚላከው ቦታ" },
  "co.shipTo": { en: "Ship to", am: "የሚላከው" },
  "co.editAddress": { en: "Edit this address", am: "ይህን አድራሻ ያስተካክሉ" },
  "co.useDifferent": { en: "+ Use a different address", am: "+ ሌላ አድራሻ ይጠቀሙ" },
  "co.backToSaved": { en: "← Back to saved addresses", am: "← ወደ ተቀመጡ አድራሻዎች" },
  "co.saveAddress": {
    en: "Save this address to my account — next time checkout is one tap.",
    am: "ይህን አድራሻ በአካውንቴ ያስቀምጡ — በሚቀጥለው ጊዜ በአንድ ጠቅታ ይክፈላሉ።",
  },
  "co.stillNeeded": { en: "Still needed: {fields}", am: "አሁንም ያስፈልጋል፦ {fields}" },
  "co.placing": { en: "Placing your order…", am: "ትዕዛዝዎ በመቅረጽ ላይ…" },
  "co.continue": { en: "Continue to payment →", am: "ወደ ክፍያ ይቀጥሉ →" },
  "co.noCharge": {
    en: "Nothing is charged here — you pay by bank transfer on the next step",
    am: "እዚህ ምንም አይከፈልም — በሚቀጥለው ደረጃ በባንክ ዝውውር ይከፍላሉ",
  },
  "co.payTitle": { en: "Pay it", am: "ይክፈሉት" },
  "co.payBody": {
    en: "Order reserved. Pick how you're paying, send the exact amount, then upload your receipt so Jo can verify it.",
    am: "ትዕዛዙ ተይዟል። የክፍያ መንገድ ይምረጡ፣ ትክክለኛውን መጠን ይላኩ፣ ከዚያ ደረሰኝዎን ይስቀሉ ስለዚህ Jo ማረጋገጥ ይችላል።",
  },
  "co.shippingTo": { en: "Shipping to", am: "የሚላከው ለ" },
  "co.paymentMethod": { en: "Payment method", am: "የክፍያ ዘዴ" },
  "co.bankTransfer": { en: "Bank transfer", am: "የባንክ ዝውውር" },
  "co.paymentLink": { en: "Payment link", am: "የክፍያ ሊንክ" },
  "co.amountToSend": { en: "Amount to send", am: "የሚላክ መጠን" },
  "co.bank": { en: "Bank", am: "ባንክ" },
  "co.accountName": { en: "Account name", am: "የሂሳብ ስም" },
  "co.accountNumber": { en: "Account number", am: "የሂሳብ ቁጥር" },
  "co.copy": { en: "Copy", am: "ቅዳ" },
  "co.copied": { en: "Copied ✓", am: "ተቀድቷል ✓" },
  "co.openLink": { en: "Open {name} ↗", am: "{name} ይክፈቱ ↗" },
  "co.paymentReference": { en: "Payment reference", am: "የክፍያ ማጣቀሻ" },
  "co.noMethodNote": {
    en: "Payment details are being set up — you can still place the order and pay later from your account page, or reach Jo directly.",
    am: "የክፍያ ዝርዝሮች በመዘጋጀት ላይ ናቸው — አሁንም ትዕዛዙን ማስቀመጥና በኋላ ከአካውንትዎ ገጽ መክፈል ይችላሉ፣ ወይም በቀጥታ ወደ Jo መምጣት ይችላሉ።",
  },
  "co.uploadReceipt": { en: "Upload your receipt", am: "ደረሰኝዎን ይስቀሉ" },
  "co.chooseFile": {
    en: "Choose a screenshot or photo of the transfer — JPG, PNG or HEIC",
    am: "የዝውውሩን ስክሪንሾት ወይም ፎቶ ይምረጡ — JPG, PNG ወይም HEIC",
  },
  "co.reference": { en: "Reference number", am: "ማጣቀሻ ቁጥር" },
  "co.optional": { en: "(optional)", am: "(አማራጭ)" },
  "co.uploadFinish": { en: "Upload receipt & finish →", am: "ደረሰኝ ይስቀሉ እና ያጠናቅቁ →" },
  "co.uploading": { en: "Uploading your receipt…", am: "ደረሰኝዎ በመስቀል ላይ…" },
  "co.doneBody": {
    en: "Order received. Jo matches your transfer in the account, usually within a few hours, and you'll see the status move live.",
    am: "ትዕዛዝ ተቀብለናል። Jo ዝውውርዎን ከሂሳቡ ጋር ያመሳስላል፣ አብዛኛውን ጊዜ በጥቂት ሰዓታት ውስጥ፣ እና ሁኔታው በቀጥታ ሲቀየር ያያሉ።",
  },
  "co.matching": { en: "What Jo is matching", am: "Jo የሚያመሳስለው" },
  "co.receipt": { en: "Receipt", am: "ደረሰኝ" },
  "co.imageAttached": { en: "Image attached ✓", am: "ምስል ተያይዟል ✓" },
  "co.referenceLabel": { en: "Reference", am: "ማጣቀሻ" },
  "co.method": { en: "Method", am: "ዘዴ" },
  "co.account": { en: "Account", am: "ሂሳብ" },
  "co.receiptPhoto": { en: "Receipt photo", am: "የደረሰኝ ፎቶ" },
  "co.attached": { en: "Attached ✓", am: "ተያይዟል ✓" },
  "co.notNeeded": { en: "Not needed", am: "አያስፈልግም" },
  "co.order": { en: "Order", am: "ትዕዛዝ" },
  "co.items": { en: "{n} item", am: "{n} ዕቃ" },
  "co.itemsPlural": { en: "{n} items", am: "{n} ዕቃዎች" },
  "co.shippingFree": { en: "Free, always", am: "ሁልጊዜ ነጻ" },
  "co.receiptSavedFailed": {
    en: "Receipt saved, but submitting failed — open the order to retry.",
    am: "ደረሰኙ ተቀምጧል፣ ግን ማስገባቱ አልተሳካም — ለመድገም ትዕዛዙን ይክፈቱ።",
  },
  "co.doneNote": {
    en: "Watch the status live from your account, or search the reference any time. If it's rejected you'll be able to submit a new receipt.",
    am: "ሁኔታውን ከአካውንትዎ በቀጥታ ይከታተሉ፣ ወይም ማጣቀሻውን በፈለጉት ጊዜ ይፈልጉ። ከተቀባይነት ካላገኘ አዲስ ደረሰኝ ማስገባት ይችላሉ።",
  },

  // ---------- shared ----------
  "common.back": { en: "Back", am: "ተመለስ" },

  // ---------- order status ----------
  "status.awaiting_payment": { en: "Awaiting payment", am: "ክፍያ በመጠበቅ ላይ" },
  "status.receipt_uploaded": { en: "Receipt uploaded", am: "ደረሰኝ ተስቀሏል" },
  "status.verifying": { en: "Verifying payment", am: "ክፍያ በመረጋገጥ ላይ" },
  "status.confirmed": { en: "Confirmed", am: "ተረጋግጧል" },
  "status.shipped": { en: "Shipped", am: "ተልኳል" },
  "status.delivered": { en: "Delivered", am: "ደርሷል" },
  "status.rejected": { en: "Receipt rejected", am: "ደረሰኝ አልተቀበለም" },
  "status.cancelled": { en: "Cancelled", am: "ተሰርዟል" },

  // ---------- auth (login / signup) ----------
  "auth.loginTitle": { en: "Welcome back", am: "እንኳን ደህና መጡ" },
  "auth.loginBody": { en: "Sign in to track orders and save pieces.", am: "ትዕዛዞችን ለመከታተልና ዕቃዎችን ለማስቀመጥ ይግቡ።" },
  "auth.email": { en: "Email", am: "ኢሜይል" },
  "auth.password": { en: "Password", am: "የይለፍ ቃል" },
  "auth.signIn": { en: "Sign in", am: "ይግቡ" },
  "auth.signingIn": { en: "Signing in…", am: "በመግባት ላይ…" },
  "auth.signedIn": { en: "Welcome back ✓", am: "እንኳን ደህና መጡ ✓" },
  "auth.forgot": { en: "Forgot password?", am: "የይለፍ ቃል ረሱ?" },
  "auth.resetSent": { en: "Reset email sent", am: "የመቀየሪያ ኢሜይል ተልኳል" },
  "auth.createAccountLink": { en: "Create account →", am: "አካውንት ይክፈቱ →" },
  "auth.or": { en: "or", am: "ወይም" },
  "auth.google": { en: "Continue with Google", am: "በGoogle ይቀጥሉ" },
  "auth.signupTitle": { en: "Join the list", am: "ዝርዝሩን ይቀላቀሉ" },
  "auth.signupBody": {
    en: "One account for orders, saved pieces and early access to drops.",
    am: "ለትዕዛዞች፣ ለተቀመጡ ዕቃዎችና ለአዲስ የወጡ ዕቃዎች ቅድሚያ አንድ አካውንት።",
  },
  "auth.name": { en: "Name", am: "ስም" },
  "auth.passwordMin": { en: "Password (6+ characters)", am: "የይለፍ ቃል (6+ ፊደሎች)" },
  "auth.createAccount": { en: "Create account", am: "አካውንት ይክፈቱ" },
  "auth.creating": { en: "Creating…", am: "በመክፈት ላይ…" },
  "auth.created": { en: "Account created ✓", am: "አካውንት ተከፍቷል ✓" },
  "auth.haveAccount": { en: "Already have one? Sign in →", am: "አካውንት አለዎት? ይግቡ →" },
  "auth.passwordShort": { en: "Password needs at least 6 characters.", am: "የይለፍ ቃል ቢያንስ 6 ፊደሎች ያስፈልገዋል።" },
  "auth.tagline1": { en: "Every hem,", am: "እያንዳንዱ ጫፍ፣" },
  "auth.tagline2": { en: "signed.", am: "ፊርማ አለው።" },
  "auth.tagline3": { en: "Cut once,", am: "አንድ ጊዜ ተቆርጦ፣" },
  "auth.tagline4": { en: "worn for years.", am: "ለዓመታት ይለበሳል።" },
  "auth.errWrong": { en: "Wrong email or password. Try again.", am: "ኢሜይል ወይም የይለፍ ቃል ስህተት ነው። እንደገና ይሞክሩ።" },
  "auth.errInUse": {
    en: "That email already has an account — sign in instead.",
    am: "ይህ ኢሜይል አካውንት አለው — በምትኩ ይግቡ።",
  },
  "auth.errWeak": { en: "Password needs at least 6 characters.", am: "የይለፍ ቃል ቢያንስ 6 ፊደሎች ያስፈልገዋል።" },
  "auth.errTooMany": { en: "Too many attempts. Wait a minute and try again.", am: "በጣም ብዙ ሙከራዎች። አንድ ደቂቃ ቆይተው ይሞክሩ።" },
  "auth.errEmail": { en: "That email doesn't look right.", am: "ያ ኢሜይል ትክክል አይመስልም።" },
  "auth.errNetwork": {
    en: "Connection hiccup — check your internet and try again.",
    am: "የግንኙነት ችግር — ኢንተርኔትዎን አረጋግጠው ይሞክሩ።",
  },
  "auth.errPopup": { en: "Google sign-in was closed before finishing.", am: "የGoogle መግቢያ ከመጠናቀቁ በፊት ተዘግቷል።" },
  "auth.errMethod": { en: "That sign-in method isn't enabled yet.", am: "ይህ የመግቢያ ዘዴ እስካሁን አልነቃም።" },
  "auth.errGeneric": { en: "Something went wrong — try again.", am: "የተሳሳተ ነገር ተከስቷል — እንደገና ይሞክሩ።" },

  // ---------- address form / cards ----------
  "address.label": { en: "Label — Home, Studio, Mum's place", am: "ስያሜ — ቤት፣ ስቱዲዮ፣ የእናቴ ቤት" },
  "address.fullName": { en: "Full name", am: "ሙሉ ስም" },
  "address.phone": { en: "Phone", am: "ስልክ" },
  "address.line1": {
    en: "Street / landmark — e.g. Bole Rwanda St, near Getu Commercial",
    am: "መንገድ / መለያ ቦታ — ለምሳሌ ቦሌ ሩዋንዳ መንገድ፣ በጌቱ ንግድ አጠገብ",
  },
  "address.line2": { en: "Apartment, building, office (optional)", am: "አፓርታማ፣ ሕንፃ፣ ቢሮ (አማራጭ)" },
  "address.city": { en: "City", am: "ከተማ" },
  "address.subCity": { en: "Sub-city / woreda — e.g. Bole, Yeka, Arada", am: "ክፍለ ከተማ / ወረዳ — ለምሳሌ ቦሌ፣ የካ፣ አራዳ" },
  "address.country": { en: "Country", am: "አገር" },
  "address.note": {
    en: "Shipping is free storewide, worldwide.",
    am: "ማድረስ በመላው ሱቅና በዓለም አቀፍ ነጻ ነው።",
  },
  "address.defaultBadge": { en: "Default", am: "ነባሪ" },
  "address.shipHere": { en: "Ship here", am: "እዚህ ይላክ" },
  "address.shippingHere": { en: "Shipping here ✓", am: "እዚህ ይላካል ✓" },
  "address.empty": { en: "Address", am: "አድራሻ" },

  // ---------- account ----------
  "account.signedInAs": { en: "Signed in as", am: "የገቡበት ስም" },
  "account.adminStudio": { en: "Admin studio", am: "የአስተዳደር ስቱዲዮ" },
  "account.signOut": { en: "Sign out", am: "ውጣ" },
  "account.ordersTab": { en: "Orders ({n})", am: "ትዕዛዞች ({n})" },
  "account.addressesTab": { en: "Address book", am: "የአድራሻ ደብተር" },
  "account.savedPieces": { en: "Saved pieces →", am: "የተቀመጡ ዕቃዎች →" },
  "account.ordersUnavailable": { en: "Orders unavailable", am: "ትዕዛዞች አይገኙም" },
  "account.tryAgain": { en: "Try again →", am: "እንደገና ይሞክሩ →" },
  "account.noOrders": { en: "No orders yet", am: "እስካሁን ትዕዛዝ የለም" },
  "account.noOrdersBody": {
    en: "When you place one, it appears here with live status.",
    am: "ትዕዛዝ ሲያስቀምጡ፣ ሁኔታውን በቀጥታ እዚህ ያያሉ።",
  },
  "account.startShopping": { en: "Start shopping →", am: "ግዢ ይጀምሩ →" },
  "account.savedAddresses": { en: "Saved addresses ({n})", am: "የተቀመጡ አድራሻዎች ({n})" },
  "account.addAddress": { en: "+ Add address", am: "+ አድራሻ ጨምር" },
  "account.noAddresses": {
    en: "No saved addresses yet. Add one on the right and checkout becomes a single tap — we'll pre-select it every time.",
    am: "እስካሁን አድራሻ አልተቀመጠም። በቀኝ በኩል አንዱን ይጨምሩ — ከዚያ ክፍያ በአንድ ጠቅታ ይሆናል፣ እና ሁልጊዜ ይህን እንመርጣለን።",
  },
  "account.makeDefault": { en: "Make default", am: "ነባሪ አድርግ" },
  "account.edit": { en: "Edit", am: "አስተካክል" },
  "account.remove": { en: "Remove", am: "አስወግድ" },
  "account.defaultNote": {
    en: "Your default address is the one checkout picks for you — change it any time with “Make default”.",
    am: "ነባሪ አድራሻዎ ክፍያ ሲደረግ በራስ-ሰር የሚመረጥ ነው — በፈለጉት ጊዜ “ነባሪ አድርግ” በመጠቀም ይቀይሩት።",
  },
  "account.editAddress": { en: "Edit address", am: "አድራሻ አስተካክል" },
  "account.addAnAddress": { en: "Add an address", am: "አድራሻ ጨምር" },
  "account.useAsDefault": { en: "Use as my default address", am: "እንደ ነባሪ አድራሻዬ ተጠቀምበት" },
  "account.saving": { en: "Saving…", am: "በማስቀመጥ ላይ…" },
  "account.saveChanges": { en: "Save changes", am: "ለውጦችን አስቀምጥ" },
  "account.saveAddress": { en: "Save address", am: "አድራሻ አስቀምጥ" },
  "account.cancel": { en: "Cancel", am: "ሰርዝ" },
  "account.keep": { en: "Keep it", am: "አቆይ" },
  "account.removeAddressTitle": { en: "Remove this address?", am: "ይህ አድራሻ ይወገድ?" },
  "account.removeAddressBody": {
    en: "It disappears from your address book. Orders already placed keep the address they were sent to.",
    am: "ከአድራሻ ደብተርዎ ይወገዳል። አስቀድመው የተላኩ ትዕዛዞች የተላኩበትን አድራሻ ይይዛሉ።",
  },
  "account.removeAddress": { en: "Remove address", am: "አድራሻ አስወግድ" },
  "account.more": { en: "+{n} more", am: "+{n} ተጨማሪ" },

  // ---------- toasts ----------
  "toast.saveFailed": { en: "Could not save — check your connection", am: "ማስቀመጥ አልተቻለም — ግንኙነትዎን ያረጋግጡ" },
  "toast.addressSaved": { en: "Address saved", am: "አድራሻ ተቀምጧል" },
  "toast.addressUpdated": { en: "Address updated", am: "አድራሻ ተስተካክሏል" },
  "toast.addressRemoved": { en: "Address removed", am: "አድራሻ ተወግዷል" },
  "toast.defaultUpdated": { en: "Default address updated", am: "ነባሪ አድራሻ ተቀይሯል" },
  "toast.addressSavedToAccount": { en: "Address saved to your account", am: "አድራሻው በአካውንትዎ ተቀምጧል" },
  "toast.addressUnsaved": {
    en: "Order continues — but we could not save that address",
    am: "ትዕዛዙ ይቀጥላል — ግን ያንን አድራሻ ማስቀመጥ አልቻልንም",
  },
  "toast.orderFailed": { en: "Order failed", am: "ትዕዛዙ አልተሳካም" },
  "toast.addReceiptFirst": { en: "Add your receipt image first", am: "መጀመሪያ የደረሰኝ ምስል ይጨምሩ" },
  "toast.pickReceipt": {
    en: "Choose a screenshot or photo of your receipt first.",
    am: "መጀመሪያ የደረሰኝዎን ስክሪንሾት ወይም ፎቶ ይምረጡ።",
  },
  "toast.receiptSavedOpen": { en: "Receipt saved — open the order to finish", am: "ደረሰኝ ተቀምጧል — ለማጠናቀቅ ትዕዛዙን ይክፈቱ" },
  "toast.receiptSubmittedJo": { en: "Receipt submitted — Jo will check it", am: "ደረሰኝ ገብቷል — Jo ያረጋግጣል" },
  "toast.uploadFailed": { en: "Upload failed", am: "መስቀል አልተሳካም" },
  "toast.submitFailed": { en: "Submit failed", am: "ማስገባት አልተሳካም" },
  "toast.receiptUploaded": { en: "Receipt uploaded", am: "ደረሰኝ ተስቀሏል" },
  "toast.receiptSubmitted": {
    en: "Receipt submitted — hang tight for verification",
    am: "ደረሰኝ ገብቷል — ማረጋገጫው ትንሽ ይወስዳል",
  },
  "toast.sizeSoldOut": { en: "That size just sold out — pick another", am: "ያ መጠን አሁን አልቋል — ሌላ ይምረጡ" },
  "toast.addedToBag": { en: "{name} — {variant} added to your bag", am: "{name} — {variant} ወደ ቦርሳዎ ተጨምሯል" },
  "toast.unsaved": { en: "Removed from saved", am: "ከተቀመጡት ተወግዷል" },
  "toast.saved": { en: "Saved for later", am: "ለበኋላ ተቀምጧል" },

  // ---------- track an order ----------
  "track.kicker": { en: "Order status", am: "የትዕዛዝ ሁኔታ" },
  "track.title": { en: "Track an order", am: "ትዕዛዝ ይከታተሉ" },
  "track.introA": {
    en: "Your reference is the code we gave you at checkout — it looks like",
    am: "ማጣቀሻዎ በክፍያ ጊዜ የሰጠንዎት ኮድ ነው — እንደዚህ ይመስላል፦",
  },
  "track.introB": {
    en: "Enter it with the email you ordered with and you'll see exactly where your order is.",
    am: "ከገዙበት ኢሜይል ጋር ያስገቡት፣ ትዕዛዝዎ የት እንደደረሰ በትክክል ያያሉ።",
  },
  "track.reference": { en: "Reference", am: "ማጣቀሻ" },
  "track.email": { en: "Email", am: "ኢሜይል" },
  "track.find": { en: "Find my order →", am: "ትዕዛዜን ፈልግ →" },
  "track.looking": { en: "Looking…", am: "በመፈለግ ላይ…" },
  "track.enterBoth": {
    en: "Enter your reference code and the email you ordered with",
    am: "የማጣቀሻ ኮድዎንና የገዙበትን ኢሜይል ያስገቡ",
  },
  "track.notFound": { en: "Could not find that order", am: "ያ ትዕዛዝ አልተገኘም" },
  "track.placed": { en: "Placed {placed} · updated {updated}", am: "የተቀመጠ {placed} · የተሻሻለ {updated}" },
  "track.rejected": {
    en: "Jo couldn't verify the payment. Send us the receipt again from your account page.",
    am: "Jo ክፍያውን ማረጋገጥ አልቻለም። ከአካውንት ገጽዎ ደረሰኙን እንደገና ይላኩ።",
  },
  "track.rejectedWhy": {
    en: "Jo couldn't verify the payment: {reason}. Send us the receipt again from your account page.",
    am: "Jo ክፍያውን ማረጋገጥ አልቻለም፦ {reason}። ከአካውንት ገጽዎ ደረሰኙን እንደገና ይላኩ።",
  },
  "track.cancelled": { en: "This order was cancelled.", am: "ይህ ትዕዛዝ ተሰርዟል።" },
  "track.tracking": { en: "Tracking —", am: "ክትትል —" },
  "track.total": { en: "Total", am: "ጠቅላላ" },
  "track.submitReceipt": { en: "Submit your receipt →", am: "ደረሰኝዎን ያስገቡ →" },
  "track.allOrders": { en: "All your orders →", am: "ሁሉም ትዕዛዞችዎ →" },
  "track.backToRack": { en: "Back to the rack", am: "ወደ መደርደሪያው" },

  // ---------- one order ----------
  "order.kicker": { en: "Order", am: "ትዕዛዝ" },
  "order.placed": { en: "Placed {placed} · {amount}", am: "የተቀመጠ {placed} · {amount}" },
  "order.referenceCode": { en: "Reference code", am: "የማጣቀሻ ኮድ" },
  "order.referenceHint": { en: "Quote this when you talk to Jo about the order.", am: "ስለ ትዕዛዙ ለJo ሲናገሩ ይህን ይጥቀሱ።" },
  "order.notFound": { en: "Order not found", am: "ትዕዛዙ አልተገኘም" },
  "order.yourOrders": { en: "← Your orders", am: "← ትዕዛዞችዎ" },
  "order.rejected": {
    en: "Jo couldn't verify the payment. Upload a clearer receipt below or reach out and we'll sort it.",
    am: "Jo ክፍያውን ማረጋገጥ አልቻለም። ከታች የበለጠ ግልጽ ደረሰኝ ይስቀሉ፣ ወይም ያግኙን እና እናስተካክለዋለን።",
  },
  "order.rejectedWhy": {
    en: "Jo couldn't verify the payment: {reason}. Upload a clearer receipt below or reach out and we'll sort it.",
    am: "Jo ክፍያውን ማረጋገጥ አልቻለም፦ {reason}። ከታች የበለጠ ግልጽ ደረሰኝ ይስቀሉ፣ ወይም ያግኙን እና እናስተካክለዋለን።",
  },
  "order.cancelled": { en: "This order was cancelled.", am: "ይህ ትዕዛዝ ተሰርዟል።" },
  "order.pieces": { en: "Pieces", am: "ዕቃዎች" },
  "order.stillNeedPayment": { en: "Still need payment?", am: "እስካሁን መክፈል ይቀራል?" },
  "order.sendAmount": {
    en: "Send {amount} via your chosen payment method, using reference {ref}, then attach your receipt here.",
    am: "{amount} በመረጡት የክፍያ ዘዴ በመጠቀም ይላኩ፣ ማጣቀሻውን {ref} ይጻፉ፣ ከዚያ ደረሰኝዎን እዚህ ያያዙ።",
  },
  "order.chooseReceipt": { en: "Choose receipt image", am: "የደረሰኝ ምስል ይምረጡ" },
  "order.replaceReceipt": { en: "Receipt attached ✓ — replace it", am: "ደረሰኝ ተያይዟል ✓ — ይቀይሩ" },
  "order.browse": { en: "Browse", am: "ያስሱ" },
  "order.uploadReceipt": { en: "Upload receipt", am: "ደረሰኝ ስቀል" },
  "order.bankRefOptional": { en: "Bank reference (optional)", am: "የባንክ ማጣቀሻ (አማራጭ)" },
  "order.submitVerify": { en: "Submit receipt for verification", am: "ደረሰኝ ለማረጋገጫ አስገባ" },
  "order.uploadThenSubmit": { en: "Upload the image, then submit", am: "ምስሉን ይስቀሉ፣ ከዚያ ያስገቡ" },
  "order.receiptHint": {
    en: "The receipt photo is what Jo checks — the reference number is optional.",
    am: "Jo የሚያረጋግጠው የደረሰኝ ፎቶ ነው — የማጣቀሻ ቁጥሩ አማራጭ ነው።",
  },
  "order.shippingTo": { en: "Shipping to", am: "የሚላከው ለ" },
  "order.tracking": { en: "Tracking", am: "ክትትል" },
  "order.activity": { en: "Activity", am: "እንቅስቃሴ" },

  // ---------- lookbook ----------
  "look.kicker": { en: "The album", am: "አልበሙ" },
  "look.title": { en: "Lookbook", am: "ሉክቡክ" },
  "look.intro": {
    en: "Frames from the bench, the cutting table and the street. Jo adds to the album as the work happens — nothing staged, nothing retouched.",
    am: "ከወርክቤንቹ፣ ከመቁረጫ ጠረጴዛውና ከመንገድ የተወሱ ፎቶዎች። Jo ስራው እየተሰራ ሲሄድ ወደ አልበሙ ይጨምራል — የተደራጀ የለም፣ የተስተካከለ የለም።",
  },
  "look.emptyTitle": { en: "The album is empty", am: "አልበሙ ባዶ ነው" },
  "look.emptyBody": {
    en: "Jo hasn't added any frames yet. Check back after the next drop.",
    am: "Jo እስካሁን ፎቶ አልጨመረም። ከሚቀጥለው የወጣ ዕቃ በኋላ ይመልከቱ።",
  },
  "look.frame": { en: "Lookbook frame", am: "የሉክቡክ ፎቶ" },
  "look.untitled": { en: "Untitled frame", am: "ርዕስ የሌለው ፎቶ" },
  "look.close": { en: "Close", am: "ዝጋ" },

  // ---------- wishlist ----------
  "wish.title": { en: "Saved", am: "የተቀመጡ" },
  "wish.emptyTitle": { en: "Nothing saved yet", am: "እስካሁን ምንም አልተቀመጠም" },
  "wish.emptyBody": { en: "Tap the heart on any piece to keep it here.", am: "ማንኛውንም ዕቃ ለማስቀመጥ በልቡ ምልክት ላይ ይጫኑ።" },
  "wish.browse": { en: "Browse the rack →", am: "መደርደሪያውን ያስሱ →" },

  // ---------- about ----------
  "about.titleA": { en: "Jo makes", am: "Jo ልብስ" },
  "about.titleB": { en: "clothes", am: "ይሰራል" },
  "about.p1": {
    en: "JO started with one machine, one pattern-cutter and a stubborn belief: that the clothes people keep are the ones someone actually made. No seasonal calendar. No factory floor. Just small runs of fabric, found once, cut properly.",
    am: "JO የጀመረው በአንድ ማሽን፣ በአንድ የስርዓተ ቅርጽ ቆራጭና በአንድ ጽኑ እምነት ነው፦ ሰዎች የሚያስቀምጡት ልብስ በእውነት በአንድ ሰው የተሰራ ነው። ወቅታዊ የቀን መቁጠሪያ የለም። የፋብሪካ አዳራሽ የለም። በትንሽ መጠን የተገኘ ጨርቅ፣ አንድ ጊዜ ብቻ፣ በትክክል ተቆርጦ።",
  },
  "about.p2": {
    en: "Every piece that leaves the studio is numbered and signed inside the hem. If you ever want to know exactly who made your jacket — you already do. It's Jo.",
    am: "ከስቱዲዮው የሚወጣ እያንዳንዱ ዕቃ ከጫፉ ስር ቁጥርና ፊርማ አለው። ጃኬትዎን በትክክል ማን እንደሰራው ማወቅ ከፈለጉ — አውቀዋል። Jo ነው።",
  },
  "about.quote": {
    en: "I'd rather make 40 good garments than 4,000 forgettable ones.",
    am: "4,000 የሚረሱ ልብሶችን ከመስራት ይልቅ 40 ጥሩ ልብሶችን መስራት እመርጣለሁ።",
  },
  "about.studio": { en: "The studio", am: "ስቱዲዮው" },
  "about.care": { en: "Garment care", am: "የልብስ እንክብካቤ" },
  "about.care1": {
    en: "Wash cold, inside out, gentle cycle. Your garment's dye will thank you.",
    am: "በቀዝቃዛ ውሃ፣ በተገላቢጦሽ፣ በለስላሳ ማሽን ያጥቡ። የልብስዎ ቀለም ያመሰግንዎታል።",
  },
  "about.care2": {
    en: "Skip the dryer. Line dry in shade; the fabric keeps its hand-feel longer.",
    am: "ማድረቂያ ማሽን አይጠቀሙ። በጥላ ላይ ለቀጥ ብለው ያድርቁ፤ ጨርቁ ለስላሳነቱን ረጅም ጊዜ ይይዛል።",
  },
  "about.care3": {
    en: "Steam rather than iron where you can. Press cloth if you must iron.",
    am: "በተቻለ መጠን በእንፋሎት ያስተካክሉ። ማብሰል ካስፈለገ ጨርቅ አድርገው ያብሱ።",
  },
  "about.care4": {
    en: "Denim and canvas: repair, don't replace. Send it back — we patch JO pieces free for life.",
    am: "ጂንስና ካንቫስ፦ ይጠግኑ፣ አይተኩ። መልሰው ይላኩ — የJO ዕቃዎችን ለዘላለም በነጻ እናበጅላቸዋለን።",
  },
  "about.shipping": { en: "Shipping & returns", am: "ማድረስና ተመላሽ" },
  "about.ship1": { en: "Worldwide shipping is free. Always. It's built into the price.", am: "በዓለም አቀፍ ማድረስ ነጻ ነው። ሁልጊዜ። በዋጋው ውስጥ ተካቷል።" },
  "about.ship2": { en: "Dispatched within 2 working days of payment verification.", am: "ክፍያ ከተረጋገጠ በ2 የስራ ቀናት ውስጥ ይላካል።" },
  "about.ship3": { en: "14-day returns on unworn pieces. Sale items are final.", am: "ያልተለበሱ ዕቃዎች በ14 ቀናት ይመለሳሉ። በሽያጭ ላይ ያሉ ዕቃዎች አይመለሱም።" },
  "about.ship4": {
    en: "Payments are bank transfer or mobile money — pick your method at checkout. A human verifies every receipt, usually within hours.",
    am: "ክፍያ በባንክ ዝውውር ወይም በሞባይል ገንዘብ ነው — በክፍያ ጊዜ ዘዴውን ይምረጡ። እያንዳንዱ ደረሰኝ በሰው ይረጋገጣል፣ አብዛኛውን ጊዜ በጥቂት ሰዓታት ውስጥ።",
  },
  "about.cta": { en: "See what's on the rack", am: "በመደርደሪያው ላይ ያለውን ይመልከቱ" },
};

/** Translate outside React (auth errors, helpers) with the current language. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>) {
  const entry = DICT[key];
  let out = entry ? entry[lang] || entry.en : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}

type LangState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Read the saved choice after mount, so the server render stays English. */
  hydrate: () => void;
};

export const useLang = create<LangState>((set) => ({
  lang: "en",
  setLang: (lang) => {
    set({ lang });
    try {
      window.localStorage.setItem("jo-lang", lang);
    } catch {
      /* private mode — the choice just won't persist */
    }
  },
  hydrate: () => {
    try {
      const saved = window.localStorage.getItem("jo-lang");
      if (saved === "am" || saved === "en") set({ lang: saved });
    } catch {
      /* ignore */
    }
  },
}));

/** Translator hook: `const { t, lang, setLang } = useT();` */
export function useT() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
  return { lang, setLang, t };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useLang((s) => s.lang);
  useEffect(() => {
    useLang.getState().hydrate();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <>{children}</>;
}
