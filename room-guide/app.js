/* Sudha Vatika room guide. No framework, no build step. Guests give a room number and a name (no
   password); requests and reviews go to the dashboard through the public room-guest function. */
(function () {
  'use strict';

  var G = window.GUIDE;
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var whoBtn = document.getElementById('who');
  var langBtn = document.getElementById('lang');
  var loadedAt = Date.now();

  // ---------- text (English / Hindi) ----------
  var T = {
    en: {
      guide: 'Guest Guide',
      welcome: 'Welcome!',
      welcomeSub: 'Tell us your room number and name so we can help you faster.',
      room: 'Room number',
      roomHint: 'for example 101',
      name: 'Your name',
      nameHint: 'for example Mr Sharma',
      go: 'Continue',
      noPass: 'No password needed.',
      needBoth: 'Please enter your room number and your name.',
      hello: 'Hello, ',
      roomWord: 'Room ',
      help: 'How can we help you?',
      callReception: 'Call Reception',
      callReceptionSub: 'Tap to call, any time',
      housekeeping: 'Housekeeping',
      housekeepingSub: 'Cleaning, towels, water',
      food: 'Food & Drinks',
      foodSub: 'On request',
      luggage: 'Luggage Help',
      luggageSub: 'Carry or keep bags',
      wifi: 'WiFi',
      wifiSub: 'Name and password',
      maintenance: 'Repair',
      maintenanceSub: 'AC, light, TV, water',
      helpdesk: 'Help Desk',
      helpdeskSub: 'Anything else',
      info: 'Hotel Info',
      infoSub: 'Check-out, address',
      mine: 'My Requests',
      mineSub: 'See what is done',
      review: 'Rate Your Stay',
      reviewSub: 'Tell us how we did',
      reception: 'Reception',
      emergency: 'Emergency',
      police: 'Police / Any emergency',
      ambulance: 'Ambulance',
      back: 'Back',
      send: 'Send request',
      sending: 'Sending…',
      pick: 'Tap what you need',
      anything: 'Anything else you want to tell us?',
      anythingHint: 'Type here (optional)',
      pickOrType: 'Please tap an option or type your request.',
      prefer: 'Prefer to talk?',
      callNow: 'Call',
      whatsapp: 'WhatsApp us',
      sent: 'Request sent!',
      sentSub: 'The team has your request and will be with you shortly.',
      sentSlow: 'Need it faster? Call reception.',
      failed: 'Could not send. Please call reception.',
      seeMine: 'See my requests',
      home: 'Back to home',
      foodNote:
        'Food is made on request. Tell us what you would like and the team will confirm what is available and when.',
      luggageNote: 'Our team will come to your room. You do not need to carry heavy bags.',
      receptionNote: 'Reception is happy to help with anything during your stay.',
      helpdeskNote: 'Write what you need and we will take care of it. For urgent help, call.',
      wifiTitle: 'WiFi',
      wifiName: 'WiFi name',
      wifiPass: 'Password',
      wifiNone: 'Please ask Reception for the WiFi name and password.',
      copy: 'Copy',
      copied: 'Copied!',
      infoTitle: 'Hotel Information',
      checkout: 'Check-out time',
      address: 'Address',
      website: 'Our website',
      maps: 'Open in Maps',
      instagram: 'Instagram',
      moreInfo: 'More information',
      mineTitle: 'My Requests',
      mineEmpty: 'No requests yet. They show here after you send one.',
      st_new: 'Received',
      st_in_progress: 'On the way',
      st_done: 'Done',
      st_cancelled: 'Cancelled',
      ago: ' ago',
      justNow: 'just now',
      min: ' min',
      hr: ' hr',
      reviewTitle: 'Rate your stay',
      reviewLead: 'Your feedback helps us look after every guest better.',
      overall: 'Overall',
      cleanliness: 'Cleanliness',
      staff: 'Staff',
      comfort: 'Comfort',
      comment: 'Your comments',
      commentHint: 'What did you like? What can we do better? (optional)',
      submit: 'Submit review',
      needStars: 'Please tap the stars to rate your stay.',
      thanks: 'Thank you!',
      thanksSub: 'Your review was sent to the team.',
      change: 'Change room or name',
      refreshing: 'Updating…',
      by: 'Sudha Vatika, Prayagraj',
      restaurants: 'Order Food Online',
      restaurantsSub: 'Nearby restaurants',
      explore: 'Explore Prayagraj',
      exploreSub: 'Map and day trip',
      restNote:
        'Food is not cooked at Sudha Vatika. Call a restaurant below to order, or use a delivery app. Ask for delivery to Sudha Vatika, Kanpur Road, Dhoomanganj.',
      restTitle: 'Nearby restaurants',
      deliveryApps: 'Delivery apps',
      restOnMap: 'Restaurants near me on the map',
      restCall: 'Call to order',
      restAll: 'All',
      restVeg: 'Veg only',
      restNone: 'No restaurants to show here yet. Please ask Reception.',
      restConfirm:
        'Numbers come from public listings. Please confirm that the restaurant delivers and what is available when you call.',
      dietVeg: 'Pure veg',
      dietNonveg: 'Non-veg',
      dietMixed: 'Veg and non-veg',
      call: 'Call',
      menu: 'See menu',
      orderOnline: 'Order from nearby restaurants',
      exploreLead:
        'Temples, sights, markets, stations and bus stands in Prayagraj, with a plan for one day.',
      tabTrip: 'One-day plan',
      tabMap: 'Map',
      tabList: 'All places',
      tripNote:
        'A relaxed plan for one day, starting early at the Sangam. Tap Directions for each place. You can change the order to suit you.',
      tripTips:
        'Timings and entry rules can change, and some parts of the Fort are closed to visitors. Carry water, wear light clothes and keep your valuables safe in the crowds. Ask Reception for a trusted driver if you need one.',
      directions: 'Directions',
      showOnMap: 'Show on map',
      fromHere: 'from Sudha Vatika',
      youAreHere: 'Your hotel',
      mapNote:
        'Pins are approximate. The Directions button finds the place by name in Google Maps.',
      mapOffline: 'The map needs internet. Please use the Plan or All places tab.',
      tabPlaces: 'Places',
      planMapTitle: 'Your route for the day',
      planMapNote:
        'Numbers show the order of the stops. The dotted line starts and ends at Sudha Vatika.',
      planStops: 'Stops, one by one',
      aboutThis: 'Read more',
      allPlaces: 'All places',
      aboutPlace: 'About this place',
      whatFind: 'What you will find here',
      bestTime: 'Best time to be here',
      howLong: 'Time to allow',
      mapOfPlace: 'Where it is',
      openMaps: 'Open in Google Maps',
      photoBy: 'Photo',
      k_housekeeping: 'Housekeeping',
      k_food: 'Food & Drinks',
      k_luggage: 'Luggage',
      k_maintenance: 'Repair',
      k_transport: 'Taxi & Travel',
      k_helpdesk: 'Help Desk',
      k_reception: 'Reception',
      k_other: 'Request',
      o_clean: 'Clean my room',
      o_towels: 'Fresh towels',
      o_sheets: 'Fresh bed sheets',
      o_blanket: 'Blanket or pillow',
      o_toiletries: 'Soap & toiletries',
      o_water: 'Drinking water',
      o_dustbin: 'Empty dustbin',
      o_tea: 'Tea',
      o_coffee: 'Coffee',
      o_breakfast: 'Breakfast',
      o_lunch: 'Lunch',
      o_dinner: 'Dinner',
      o_snacks: 'Snacks',
      o_carryin: 'Carry bags to my room',
      o_carryout: 'Carry bags down',
      o_store: 'Keep my bags safe',
      o_trolley: 'Need a trolley',
      o_ac: 'AC problem',
      o_light: 'Light or fan',
      o_tv: 'TV or remote',
      o_hotwater: 'No hot water',
      o_plumbing: 'Tap or toilet',
      o_other: 'Something else',
      o_wake: 'Wake-up call',
      o_late: 'Late check-out',
      o_bill: 'Prepare my bill',
      o_bed: 'Extra bed',
    },
    hi: {
      guide: 'अतिथि गाइड',
      welcome: 'स्वागत है!',
      welcomeSub: 'अपना कमरा नंबर और नाम बताइए, ताकि हम जल्दी मदद कर सकें।',
      room: 'कमरा नंबर',
      roomHint: 'जैसे 101',
      name: 'आपका नाम',
      nameHint: 'जैसे श्री शर्मा',
      go: 'आगे बढ़ें',
      noPass: 'पासवर्ड की ज़रूरत नहीं है।',
      needBoth: 'कृपया अपना कमरा नंबर और नाम लिखें।',
      hello: 'नमस्ते, ',
      roomWord: 'कमरा ',
      help: 'हम आपकी क्या मदद करें?',
      callReception: 'रिसेप्शन को फ़ोन करें',
      callReceptionSub: 'कभी भी, दबाकर कॉल करें',
      housekeeping: 'हाउसकीपिंग',
      housekeepingSub: 'सफ़ाई, तौलिये, पानी',
      food: 'खाना और पेय',
      foodSub: 'माँगने पर',
      luggage: 'सामान में मदद',
      luggageSub: 'बैग उठाना या रखना',
      wifi: 'वाई-फ़ाई',
      wifiSub: 'नाम और पासवर्ड',
      maintenance: 'मरम्मत',
      maintenanceSub: 'AC, लाइट, TV, पानी',
      helpdesk: 'हेल्प डेस्क',
      helpdeskSub: 'कुछ और चाहिए',
      info: 'होटल की जानकारी',
      infoSub: 'चेक-आउट, पता',
      mine: 'मेरे अनुरोध',
      mineSub: 'देखें क्या हुआ',
      review: 'अपना अनुभव बताएँ',
      reviewSub: 'हमें बताइए कैसा रहा',
      reception: 'रिसेप्शन',
      emergency: 'आपात स्थिति',
      police: 'पुलिस / कोई भी आपात',
      ambulance: 'एम्बुलेंस',
      back: 'पीछे',
      send: 'अनुरोध भेजें',
      sending: 'भेज रहे हैं…',
      pick: 'जो चाहिए उसे दबाएँ',
      anything: 'कुछ और बताना है?',
      anythingHint: 'यहाँ लिखें (ज़रूरी नहीं)',
      pickOrType: 'कृपया कोई विकल्प दबाएँ या अपनी बात लिखें।',
      prefer: 'बात करना चाहते हैं?',
      callNow: 'फ़ोन करें',
      whatsapp: 'व्हाट्सऐप करें',
      sent: 'अनुरोध भेज दिया गया!',
      sentSub: 'टीम को आपका अनुरोध मिल गया है, जल्दी ही आपके पास आएगी।',
      sentSlow: 'जल्दी चाहिए? रिसेप्शन को फ़ोन करें।',
      failed: 'भेज नहीं पाए। कृपया रिसेप्शन को फ़ोन करें।',
      seeMine: 'मेरे अनुरोध देखें',
      home: 'होम पर जाएँ',
      foodNote:
        'खाना माँगने पर बनाया जाता है। बताइए क्या चाहिए, टीम बताएगी कि क्या उपलब्ध है और कब तक मिलेगा।',
      luggageNote: 'हमारी टीम आपके कमरे में आएगी। भारी बैग आपको नहीं उठाने पड़ेंगे।',
      receptionNote: 'ठहरने के दौरान किसी भी काम में रिसेप्शन आपकी मदद करेगा।',
      helpdeskNote: 'जो चाहिए लिखिए, हम सँभाल लेंगे। जल्दी हो तो फ़ोन करें।',
      wifiTitle: 'वाई-फ़ाई',
      wifiName: 'वाई-फ़ाई का नाम',
      wifiPass: 'पासवर्ड',
      wifiNone: 'वाई-फ़ाई का नाम और पासवर्ड रिसेप्शन से पूछें।',
      copy: 'कॉपी करें',
      copied: 'कॉपी हो गया!',
      infoTitle: 'होटल की जानकारी',
      checkout: 'चेक-आउट का समय',
      address: 'पता',
      website: 'हमारी वेबसाइट',
      maps: 'मैप में खोलें',
      instagram: 'इंस्टाग्राम',
      moreInfo: 'और जानकारी',
      mineTitle: 'मेरे अनुरोध',
      mineEmpty: 'अभी कोई अनुरोध नहीं। भेजने के बाद यहाँ दिखेंगे।',
      st_new: 'मिल गया',
      st_in_progress: 'आ रहे हैं',
      st_done: 'हो गया',
      st_cancelled: 'रद्द',
      ago: ' पहले',
      justNow: 'अभी',
      min: ' मिनट',
      hr: ' घंटे',
      reviewTitle: 'अपना अनुभव बताएँ',
      reviewLead: 'आपकी राय से हम हर मेहमान की बेहतर देखभाल कर पाते हैं।',
      overall: 'कुल मिलाकर',
      cleanliness: 'सफ़ाई',
      staff: 'स्टाफ़',
      comfort: 'आराम',
      comment: 'आपकी टिप्पणी',
      commentHint: 'क्या अच्छा लगा? हम क्या बेहतर करें? (ज़रूरी नहीं)',
      submit: 'राय भेजें',
      needStars: 'कृपया सितारे दबाकर रेटिंग दें।',
      thanks: 'धन्यवाद!',
      thanksSub: 'आपकी राय टीम तक पहुँच गई।',
      change: 'कमरा या नाम बदलें',
      refreshing: 'अपडेट हो रहा है…',
      by: 'सुधा वाटिका, प्रयागराज',
      restaurants: 'ऑनलाइन खाना मँगाएँ',
      restaurantsSub: 'पास के रेस्टोरेंट',
      explore: 'प्रयागराज घूमें',
      exploreSub: 'नक्शा और एक दिन की यात्रा',
      restNote:
        'सुधा वाटिका में खाना नहीं बनता। नीचे किसी रेस्टोरेंट को फ़ोन करके ऑर्डर करें, या डिलीवरी ऐप इस्तेमाल करें। डिलीवरी का पता: सुधा वाटिका, कानपुर रोड, धूमनगंज।',
      restTitle: 'पास के रेस्टोरेंट',
      deliveryApps: 'डिलीवरी ऐप',
      restOnMap: 'नक्शे पर मेरे पास के रेस्टोरेंट',
      restCall: 'फ़ोन करके ऑर्डर करें',
      restAll: 'सभी',
      restVeg: 'सिर्फ़ शाकाहारी',
      restNone: 'यहाँ अभी कोई रेस्टोरेंट नहीं। कृपया रिसेप्शन से पूछें।',
      restConfirm:
        'नंबर सार्वजनिक सूचियों से लिए गए हैं। फ़ोन करके पक्का कर लें कि डिलीवरी होती है और क्या उपलब्ध है।',
      dietVeg: 'शुद्ध शाकाहारी',
      dietNonveg: 'मांसाहारी',
      dietMixed: 'शाकाहारी और मांसाहारी',
      call: 'फ़ोन',
      menu: 'मेन्यू देखें',
      orderOnline: 'पास के रेस्टोरेंट से मँगाएँ',
      exploreLead:
        'प्रयागराज के मंदिर, दर्शनीय स्थल, बाज़ार, स्टेशन और बस अड्डे, और एक दिन की योजना।',
      tabTrip: 'एक दिन की योजना',
      tabMap: 'नक्शा',
      tabList: 'सभी जगहें',
      tripNote:
        'एक दिन की आरामदायक योजना, सुबह जल्दी संगम से शुरू। हर जगह के लिए रास्ता देखें। क्रम अपनी सुविधा से बदल सकते हैं।',
      tripTips:
        'समय और प्रवेश के नियम बदल सकते हैं, और किले के कुछ हिस्से आम लोगों के लिए बंद हैं। पानी साथ रखें, हल्के कपड़े पहनें और भीड़ में कीमती सामान सँभालकर रखें। भरोसेमंद ड्राइवर चाहिए तो रिसेप्शन से पूछें।',
      directions: 'रास्ता',
      showOnMap: 'नक्शे पर देखें',
      fromHere: 'सुधा वाटिका से',
      youAreHere: 'आपका होटल',
      mapNote: 'पिन अनुमानित हैं। रास्ता बटन Google Maps में नाम से जगह खोजता है।',
      mapOffline: 'नक्शे के लिए इंटरनेट चाहिए। कृपया योजना या सभी जगहें देखें।',
      tabPlaces: 'जगहें',
      planMapTitle: 'दिन भर का आपका रास्ता',
      planMapNote:
        'अंक पड़ावों का क्रम दिखाते हैं। बिंदीदार रेखा सुधा वाटिका से शुरू होकर वहीं खत्म होती है।',
      planStops: 'एक-एक करके पड़ाव',
      aboutThis: 'और पढ़ें',
      allPlaces: 'सभी जगहें',
      aboutPlace: 'इस जगह के बारे में',
      whatFind: 'यहाँ क्या मिलेगा',
      bestTime: 'यहाँ जाने का सबसे अच्छा समय',
      howLong: 'कितना समय रखें',
      mapOfPlace: 'यह कहाँ है',
      openMaps: 'Google Maps में खोलें',
      photoBy: 'फ़ोटो',
      k_housekeeping: 'हाउसकीपिंग',
      k_food: 'खाना और पेय',
      k_luggage: 'सामान',
      k_maintenance: 'मरम्मत',
      k_transport: 'टैक्सी और यात्रा',
      k_helpdesk: 'हेल्प डेस्क',
      k_reception: 'रिसेप्शन',
      k_other: 'अनुरोध',
      o_clean: 'कमरे की सफ़ाई',
      o_towels: 'साफ़ तौलिये',
      o_sheets: 'साफ़ चादरें',
      o_blanket: 'कंबल या तकिया',
      o_toiletries: 'साबुन और ज़रूरी सामान',
      o_water: 'पीने का पानी',
      o_dustbin: 'कूड़ेदान खाली करें',
      o_tea: 'चाय',
      o_coffee: 'कॉफ़ी',
      o_breakfast: 'नाश्ता',
      o_lunch: 'दोपहर का खाना',
      o_dinner: 'रात का खाना',
      o_snacks: 'स्नैक्स',
      o_carryin: 'बैग कमरे तक लाएँ',
      o_carryout: 'बैग नीचे ले जाएँ',
      o_store: 'मेरा सामान सँभालें',
      o_trolley: 'ट्रॉली चाहिए',
      o_ac: 'AC में दिक्कत',
      o_light: 'लाइट या पंखा',
      o_tv: 'TV या रिमोट',
      o_hotwater: 'गर्म पानी नहीं',
      o_plumbing: 'नल या शौचालय',
      o_other: 'कुछ और',
      o_wake: 'सुबह जगाने का कॉल',
      o_late: 'देर से चेक-आउट',
      o_bill: 'मेरा बिल तैयार करें',
      o_bed: 'एक्स्ट्रा बेड',
    },
  };

  // ---------- what each service offers ----------
  var SERVICES = {
    housekeeping: {
      icon: '🧹',
      cls: 'c-house',
      opts: [
        ['clean', '🧹'],
        ['towels', '🧺'],
        ['sheets', '🛏️'],
        ['blanket', '🛌'],
        ['toiletries', '🧴'],
        ['water', '💧'],
        ['dustbin', '🗑️'],
      ],
    },
    food: {
      icon: '🍽️',
      cls: 'c-food',
      note: 'foodNote',
      opts: [
        ['tea', '☕'],
        ['coffee', '☕'],
        ['breakfast', '🥞'],
        ['lunch', '🍛'],
        ['dinner', '🍲'],
        ['snacks', '🍪'],
        ['water', '💧'],
      ],
    },
    luggage: {
      icon: '🧳',
      cls: 'c-bag',
      note: 'luggageNote',
      opts: [
        ['carryin', '🧳'],
        ['carryout', '⬇️'],
        ['store', '🔒'],
        ['trolley', '🛒'],
      ],
    },
    maintenance: {
      icon: '🔧',
      cls: 'c-fix',
      opts: [
        ['ac', '❄️'],
        ['light', '💡'],
        ['tv', '📺'],
        ['hotwater', '🚿'],
        ['plumbing', '🚰'],
        ['other', '🔧'],
      ],
    },
    reception: {
      icon: '🛎️',
      cls: 'c-help',
      note: 'receptionNote',
      opts: [
        ['wake', '⏰'],
        ['late', '🕐'],
        ['bill', '🧾'],
        ['bed', '🛏️'],
      ],
    },
    helpdesk: { icon: '🙋', cls: 'c-help', note: 'helpdeskNote', opts: [] },
  };

  var TILES = [
    ['housekeeping', '🧹', 'c-house'],
    ['food', '🍽️', 'c-food'],
    ['restaurants', '🍴', 'c-rest'],
    ['explore', '🗺️', 'c-map'],
    ['luggage', '🧳', 'c-bag'],
    ['wifi', '📶', 'c-wifi'],
    ['maintenance', '🔧', 'c-fix'],
    ['helpdesk', '🙋', 'c-help'],
    ['info', 'ℹ️', 'c-info'],
    ['mine', '📋', 'c-list'],
    ['review', '⭐', 'c-star'],
  ];

  // ---------- state ----------
  var lang = load('sv_lang') || (/^hi/i.test(navigator.language || '') ? 'hi' : 'en');
  var guest = { room: '', name: '' };
  try {
    guest = JSON.parse(load('sv_guest') || '{}') || {};
  } catch {
    guest = {};
  }
  var urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom && urlRoom.trim() && urlRoom.trim() !== guest.room) {
    guest = { room: urlRoom.trim().slice(0, 20), name: '' }; // a new QR scan: confirm the name
  }
  var picked = {};
  var timer = null;

  function load(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  function save(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: the guide still works, it just asks again next time */
    }
  }
  function t(k) {
    return (T[lang] && T[lang][k]) || T.en[k] || k;
  }
  function ready() {
    return !!(guest.room && guest.name);
  }

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function ico(emoji) {
    return h('span', { class: 'ic', 'aria-hidden': 'true', text: emoji });
  }
  function toast(msg, err) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (err ? ' err' : '');
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () {
      toastEl.hidden = true;
    }, 4500);
  }
  function telLink(p) {
    return 'tel:+' + p;
  }
  function waLink(text) {
    return 'https://wa.me/' + G.reception.phone + '?text=' + encodeURIComponent(text);
  }

  // ---------- network ----------
  function post(body) {
    var ctl = new AbortController();
    var timeout = setTimeout(function () {
      ctl.abort();
    }, 12000);
    return fetch(G.api, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j && j.error ? j.error : 'http ' + r.status);
          return j;
        });
      })
      .finally(function () {
        clearTimeout(timeout);
      });
  }

  // ---------- routing (hash, so the phone's Back button works) ----------
  function route() {
    clearInterval(timer);
    toastEl.hidden = true;
    var hash = (location.hash || '#home').slice(1);
    if (!ready() && hash !== 'welcome') {
      location.replace('#welcome');
      return;
    }
    if (ready() && hash === 'welcome' && !editing) {
      location.replace('#home');
      return;
    }
    var fn = SCREENS[hash] || (SERVICES[hash] ? serviceScreen : null);
    if (!fn && hash.indexOf('place-') === 0)
      fn = function () {
        placeScreen(hash.slice(6));
      };
    if (!fn) {
      location.replace('#home');
      return;
    }
    app.textContent = '';
    loadedAt = Date.now();
    fn(hash);
    renderWho();
    window.scrollTo(0, 0);
    app.focus();
  }
  var editing = false;
  function go(screen) {
    if (location.hash === '#' + screen) route();
    else location.hash = '#' + screen;
  }
  function renderWho() {
    whoBtn.hidden = !ready();
    whoBtn.textContent = ready() ? t('roomWord') + guest.room + ' ✎' : '';
    langBtn.textContent = lang === 'hi' ? 'EN' : 'हिं';
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    document.querySelectorAll('[data-t]').forEach(function (n) {
      n.textContent = t(n.getAttribute('data-t'));
    });
  }

  // ---------- shared pieces ----------
  function backBtn() {
    return h(
      'button',
      {
        class: 'back',
        onclick: function () {
          go('home');
        },
      },
      [h('span', { text: '←', 'aria-hidden': 'true' }), t('back')],
    );
  }
  function callRow() {
    return h('div', { class: 'callbar' }, [
      h('p', { text: t('prefer') }),
      h('div', { class: 'row2' }, [
        h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [ico('📞'), t('callNow')]),
        h(
          'a',
          {
            class: 'btn wa',
            href: waLink('Room ' + guest.room + ' (' + guest.name + '): '),
            target: '_blank',
            rel: 'noopener',
          },
          [ico('💬'), 'WhatsApp'],
        ),
      ]),
    ]);
  }

  // ---------- explore helpers ----------
  var exploreTab = 'trip';
  var placeById = {};
  (window.PLACES || []).forEach(function (p) {
    placeById[p.id] = p;
  });
  var catById = {};
  (window.CATEGORIES || []).forEach(function (c) {
    catById[c.id] = c;
  });

  function pName(p) {
    return lang === 'hi' ? p.hi : p.en;
  }
  function pDesc(p) {
    return lang === 'hi' ? p.dh : p.de;
  }
  function kmFromVenue(p) {
    var R = 6371;
    var v = window.VENUE;
    var dLat = ((p.lat - v.lat) * Math.PI) / 180;
    var dLon = ((p.lon - v.lon) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((v.lat * Math.PI) / 180) *
        Math.cos((p.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var straight = 2 * R * Math.asin(Math.sqrt(a));
    return Math.max(1, Math.round(straight * 1.35)); // roads are longer than a straight line
  }
  function away(p) {
    return '≈ ' + kmFromVenue(p) + ' km ' + t('fromHere');
  }
  function dirLink(p) {
    return (
      'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' +
      encodeURIComponent(p.en + ', Prayagraj')
    );
  }
  function showPhone(p) {
    var m = /^\+91(\d{10})$/.exec(p || '');
    if (!m) return p || '';
    var d = m[1];
    return /^[6-9]/.test(d)
      ? '+91 ' + d.slice(0, 5) + ' ' + d.slice(5)
      : '+91 ' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  }
  function dirBtn(p, cls) {
    return h(
      'a',
      { class: 'btn ' + (cls || 'ghost'), href: dirLink(p), target: '_blank', rel: 'noopener' },
      [ico('🧭'), t('directions')],
    );
  }

  function imgOf(p) {
    return (window.PLACE_IMG || {})[p.id];
  }
  function thumb(p, cls) {
    var im = imgOf(p);
    var c = catById[p.c];
    if (im) return h('img', { class: cls, src: im.file, alt: pName(p), loading: 'lazy' });
    return h('div', {
      class: cls + ' noimg',
      style: 'background:' + c.color,
      'aria-hidden': 'true',
      text: c.icon,
    });
  }
  function textOf(p) {
    return (window.PLACE_TEXT || {})[p.id] || {};
  }
  function numIcon(L, n) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin num">' + n + '</div>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    });
  }
  function homeIcon(L) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin home">🏨</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -20],
    });
  }
  function osmTiles(L, map) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
  }
  function mapBox(cls) {
    return h('div', { class: 'map ' + (cls || ''), role: 'img', 'aria-label': t('tabMap') }, [
      h('p', { class: 'lead', style: 'padding:16px', text: t('refreshing') }),
    ]);
  }
  function mapFailed(el) {
    el.textContent = '';
    el.appendChild(h('p', { class: 'lead', style: 'padding:16px', text: t('mapOffline') }));
  }

  // The route for the day: numbered stops joined by a line, starting and ending at the hotel.
  function planMap(box) {
    var el = mapBox('small');
    box.appendChild(el);
    withLeaflet(function (ok) {
      if (!document.body.contains(el)) return;
      if (!ok) return mapFailed(el);
      var L = window.L;
      el.textContent = '';
      var map = L.map(el, { scrollWheelZoom: false });
      osmTiles(L, map);
      var v = window.VENUE;
      var pts = [[v.lat, v.lon]];
      L.marker([v.lat, v.lon], { icon: homeIcon(L), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>' + v.name + '</b><br>' + t('youAreHere'));
      (window.ITINERARY || []).forEach(function (s, i) {
        var p = placeById[s.id];
        pts.push([p.lat, p.lon]);
        var pop = h('div', { class: 'pop' }, [
          h('b', { text: i + 1 + '. ' + pName(p) }),
          h('div', { class: 'rest-line', text: s.t + ' · ' + away(p) }),
          h('a', { class: 'btn green', href: dirLink(p), target: '_blank', rel: 'noopener' }, [
            ico('🧭'),
            t('directions'),
          ]),
        ]);
        L.marker([p.lat, p.lon], { icon: numIcon(L, i + 1) })
          .addTo(map)
          .bindPopup(pop, { minWidth: 210 });
      });
      pts.push([v.lat, v.lon]);
      L.polyline(pts, { color: '#6b1d2a', weight: 3, opacity: 0.7, dashArray: '2 8' }).addTo(map);
      map.fitBounds(pts, { padding: [24, 24] });
    });
  }

  // One place on its own map, with the hotel for scale.
  function placeMap(box, p) {
    var el = mapBox('small');
    box.appendChild(el);
    withLeaflet(function (ok) {
      if (!document.body.contains(el)) return;
      if (!ok) return mapFailed(el);
      var L = window.L;
      el.textContent = '';
      var map = L.map(el, { scrollWheelZoom: false });
      osmTiles(L, map);
      var c = catById[p.c];
      var v = window.VENUE;
      var m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: 'pin-wrap',
          html: '<div class="pin" style="background:' + c.color + '">' + c.icon + '</div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -18],
        }),
      })
        .addTo(map)
        .bindPopup('<b>' + pName(p) + '</b>');
      L.marker([v.lat, v.lon], { icon: homeIcon(L), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>' + v.name + '</b><br>' + t('youAreHere'));
      map.setView([p.lat, p.lon], 15);
      m.openPopup();
    });
  }

  function tripView(box) {
    box.appendChild(h('div', { class: 'note', text: t('tripNote') }));
    box.appendChild(h('h2', { text: '🧭 ' + t('planMapTitle') }));
    planMap(box);
    box.appendChild(h('p', { class: 'foot', text: t('planMapNote') }));
    box.appendChild(h('h2', { text: '🗓️ ' + t('planStops') }));
    (window.ITINERARY || []).forEach(function (s, i) {
      var p = placeById[s.id];
      box.appendChild(
        h('div', { class: 'card stop' }, [
          h('div', { class: 'stop-top' }, [
            h('span', { class: 'stop-num', text: String(i + 1) }),
            h('span', { class: 'stop-time', text: s.t }),
            h('span', { class: 'stop-dur', text: '⏱ ' + s.d }),
          ]),
          h('div', { class: 'stop-body' }, [
            h(
              'button',
              {
                class: 'stop-thumb',
                'aria-label': pName(p),
                onclick: function () {
                  go('place-' + p.id);
                },
              },
              [thumb(p, 'pimg')],
            ),
            h('div', { class: 'stop-text' }, [
              h('b', { text: lang === 'hi' ? s.hi : s.en }),
              h('p', { class: 'stop-desc', text: pName(p) + ' · ' + away(p) }),
            ]),
          ]),
          h('div', { class: 'row2' }, [
            h(
              'button',
              {
                class: 'btn ghost',
                onclick: function () {
                  go('place-' + p.id);
                },
              },
              [ico('📖'), t('aboutThis')],
            ),
            dirBtn(p),
          ]),
        ]),
      );
    });
    box.appendChild(h('div', { class: 'note', text: t('tripTips') }));
  }

  // Picture tiles for every place, grouped by kind. Tap a tile to read about it.
  function tilesView(box) {
    (window.CATEGORIES || []).forEach(function (c) {
      box.appendChild(h('h2', { text: c.icon + ' ' + (lang === 'hi' ? c.hi : c.en) }));
      var grid = h('div', { class: 'ptiles' });
      window.PLACES.filter(function (p) {
        return p.c === c.id;
      })
        .sort(function (a, b) {
          return kmFromVenue(a) - kmFromVenue(b);
        })
        .forEach(function (p) {
          grid.appendChild(
            h(
              'button',
              {
                class: 'ptile',
                onclick: function () {
                  go('place-' + p.id);
                },
              },
              [
                thumb(p, 'pimg'),
                h('span', { class: 'pname', text: pName(p) }),
                h('span', { class: 'pkm', text: away(p) }),
              ],
            ),
          );
        });
      box.appendChild(grid);
    });
  }

  var leafletState = 'idle'; // idle, loading, ready, failed
  var leafletWaiters = [];
  function withLeaflet(cb) {
    if (leafletState === 'ready') return cb(true);
    if (leafletState === 'failed') return cb(false);
    leafletWaiters.push(cb);
    if (leafletState === 'loading') return;
    leafletState = 'loading';
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.crossOrigin = '';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.crossOrigin = '';
    function done(ok) {
      leafletState = ok ? 'ready' : 'failed';
      leafletWaiters.splice(0).forEach(function (fn) {
        fn(ok);
      });
    }
    js.onload = function () {
      done(!!window.L);
    };
    js.onerror = function () {
      done(false);
    };
    document.head.appendChild(js);
  }

  function mapView(box, focusId) {
    var L;
    var active = {};
    (window.CATEGORIES || []).forEach(function (c) {
      active[c.id] = true;
    });
    var chips = h('div', { class: 'chips' });
    var mapEl = h('div', { id: 'map', class: 'map', 'aria-label': t('tabMap') }, [
      h('p', { class: 'lead', style: 'padding:16px', text: t('refreshing') }),
    ]);
    var layers = {};
    var markers = {};
    function paintChips() {
      chips.textContent = '';
      window.CATEGORIES.forEach(function (c) {
        chips.appendChild(
          h(
            'button',
            {
              class: 'chip' + (active[c.id] ? ' on' : ''),
              onclick: function () {
                active[c.id] = !active[c.id];
                paintChips();
                if (L) applyLayers();
              },
            },
            [c.icon + ' ' + (lang === 'hi' ? c.hi : c.en)],
          ),
        );
      });
    }
    function applyLayers() {
      Object.keys(layers).forEach(function (id) {
        if (active[id]) layers[id].addTo(map);
        else map.removeLayer(layers[id]);
      });
    }
    var map = null;
    paintChips();
    box.appendChild(chips);
    box.appendChild(mapEl);
    box.appendChild(h('p', { class: 'foot', text: t('mapNote') }));
    withLeaflet(function (ok) {
      if (!ok || !document.body.contains(mapEl)) {
        if (!ok) {
          mapEl.textContent = '';
          mapEl.appendChild(
            h('p', { class: 'lead', style: 'padding:16px', text: t('mapOffline') }),
          );
        }
        return;
      }
      L = window.L;
      mapEl.textContent = '';
      map = L.map(mapEl, { scrollWheelZoom: false }).setView(
        [window.VENUE.lat, window.VENUE.lon],
        12,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      var all = [[window.VENUE.lat, window.VENUE.lon]];
      window.CATEGORIES.forEach(function (c) {
        layers[c.id] = L.layerGroup();
      });
      window.PLACES.forEach(function (p) {
        var c = catById[p.c];
        var icon = L.divIcon({
          className: 'pin-wrap',
          html: '<div class="pin" style="background:' + c.color + '">' + c.icon + '</div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -18],
        });
        var pop = h('div', { class: 'pop' }, [
          h('b', { text: pName(p) }),
          h('div', { class: 'rest-line', text: away(p) }),
          h('div', { class: 'pop-desc', text: pDesc(p) }),
          h('a', { class: 'btn green', href: dirLink(p), target: '_blank', rel: 'noopener' }, [
            ico('🧭'),
            t('directions'),
          ]),
        ]);
        var m = L.marker([p.lat, p.lon], { icon: icon, title: pName(p) }).bindPopup(pop, {
          minWidth: 220,
        });
        layers[p.c].addLayer(m);
        markers[p.id] = m;
        all.push([p.lat, p.lon]);
      });
      applyLayers();
      L.marker([window.VENUE.lat, window.VENUE.lon], {
        icon: L.divIcon({
          className: 'pin-wrap',
          html: '<div class="pin home">🏨</div>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          popupAnchor: [0, -20],
        }),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup('<b>' + window.VENUE.name + '</b><br>' + t('youAreHere'));
      map.fitBounds(all, { padding: [24, 24] });
      if (focusId && markers[focusId]) {
        var p = placeById[focusId];
        map.setView([p.lat, p.lon], 15);
        markers[focusId].openPopup();
        mapEl.scrollIntoView({ block: 'center' });
      }
    });
  }

  // The page for one place: picture, about, what is there, best time, and its own map at the bottom.
  function placeScreen(id) {
    var p = placeById[id];
    if (!p) {
      go('explore');
      return;
    }
    var x = textOf(p);
    var c = catById[p.c];
    var im = imgOf(p);
    var hi = lang === 'hi';
    app.appendChild(
      h(
        'button',
        {
          class: 'back',
          onclick: function () {
            exploreTab = 'places';
            go('explore');
          },
        },
        [h('span', { text: '←', 'aria-hidden': 'true' }), t('allPlaces')],
      ),
    );
    app.appendChild(h('div', { class: 'hero-img' }, [thumb(p, 'pimg big')]));
    if (im && im.credit) {
      app.appendChild(
        h('p', { class: 'credit' }, [
          t('photoBy') + ': ' + im.credit + ' · ',
          h('a', { href: im.url, target: '_blank', rel: 'noopener', text: im.license }),
          ' · Wikimedia Commons',
        ]),
      );
    }
    app.appendChild(h('h1', { text: pName(p) }));
    if (hi && p.en) app.appendChild(h('p', { class: 'rest-line', text: p.en }));
    app.appendChild(
      h('p', { class: 'rest-line', text: c.icon + ' ' + (hi ? c.hi : c.en) + ' · ' + away(p) }),
    );
    app.appendChild(
      h('div', { class: 'card' }, [
        h('h2', { style: 'margin-top:0', text: t('aboutPlace') }),
        h('p', { class: 'body', text: hi ? x.ah || pDesc(p) : x.ab || pDesc(p) }),
      ]),
    );
    var hl = hi ? x.hh : x.hl;
    if (hl && hl.length) {
      app.appendChild(
        h('div', { class: 'card', style: 'margin-top:12px' }, [
          h('h2', { style: 'margin-top:0', text: t('whatFind') }),
          h(
            'ul',
            { class: 'bul' },
            hl.map(function (li) {
              return h('li', { text: li });
            }),
          ),
        ]),
      );
    }
    app.appendChild(
      h('div', { class: 'card best', style: 'margin-top:12px' }, [
        h('h2', { style: 'margin-top:0', text: '⏰ ' + t('bestTime') }),
        h('p', { class: 'body', text: hi ? x.bh : x.bt }),
        x.dur
          ? h('p', { class: 'dur', text: '⌛ ' + t('howLong') + ': ' + (hi ? x.dd : x.dur) })
          : null,
      ]),
    );
    app.appendChild(h('div', { style: 'height:12px' }));
    app.appendChild(dirBtn(p, 'green'));
    app.appendChild(h('h2', { text: '📍 ' + t('mapOfPlace') }));
    placeMap(app, p);
    app.appendChild(
      h(
        'a',
        {
          class: 'btn ghost',
          style: 'margin-top:12px',
          href:
            'https://www.google.com/maps/search/?api=1&query=' +
            encodeURIComponent(p.en + ', Prayagraj'),
          target: '_blank',
          rel: 'noopener',
        },
        [ico('🗺️'), t('openMaps')],
      ),
    );
  }

  // ---------- screens ----------
  var SCREENS = {
    welcome: function () {
      editing = true;
      var room = h('input', {
        type: 'text',
        id: 'room',
        value: guest.room || '',
        placeholder: t('roomHint'),
        autocomplete: 'off',
        maxlength: '20',
        inputmode: 'text',
        enterkeyhint: 'next',
      });
      var name = h('input', {
        type: 'text',
        id: 'name',
        value: guest.name || '',
        placeholder: t('nameHint'),
        autocomplete: 'name',
        maxlength: '80',
        enterkeyhint: 'done',
      });
      function submit() {
        var r = room.value.trim().replace(/\s+/g, ' ');
        var n = name.value.trim().replace(/\s+/g, ' ');
        if (!r || !n || !/^[A-Za-z0-9 /-]+$/.test(r)) {
          toast(t('needBoth'), true);
          (!r ? room : name).focus();
          return;
        }
        guest = { room: r, name: n };
        save('sv_guest', JSON.stringify(guest));
        editing = false;
        go('home');
      }
      [room, name].forEach(function (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') submit();
        });
      });
      app.appendChild(
        h('div', { class: 'hero' }, [
          h('div', { class: 'big', 'aria-hidden': 'true', text: '🙏' }),
          h('h1', { text: t('welcome') }),
          h('p', { text: t('welcomeSub') }),
        ]),
      );
      app.appendChild(
        h('div', { class: 'card' }, [
          h('label', { for: 'room', text: t('room') }),
          room,
          h('label', { for: 'name', text: t('name') }),
          name,
          h('div', { style: 'height:16px' }),
          h('button', { class: 'btn', onclick: submit }, [t('go'), ' →']),
          h('p', { class: 'foot', text: t('noPass') }),
        ]),
      );
      if (guest.room && !guest.name) name.focus();
    },

    home: function () {
      var tiles = [
        h('a', { class: 'tile call', href: telLink(G.reception.phone) }, [
          h('span', { class: 'ico', 'aria-hidden': 'true', text: '📞' }),
          h('span', {}, [
            h('b', { text: t('callReception') }),
            h('br'),
            h('small', { text: t('callReceptionSub') }),
            h('br'),
            h('small', { text: G.reception.show }),
          ]),
        ]),
      ];
      TILES.forEach(function (x) {
        tiles.push(
          h(
            'button',
            {
              class: 'tile ' + x[2],
              onclick: function () {
                go(x[0]);
              },
            },
            [
              h('span', { class: 'ico', 'aria-hidden': 'true', text: x[1] }),
              h('b', { text: t(x[0]) }),
              h('small', { text: t(x[0] + 'Sub') }),
            ],
          ),
        );
      });
      app.appendChild(
        h('div', { class: 'hello' }, [
          h('h1', { text: t('hello') + guest.name }),
          h('p', { text: t('roomWord') + guest.room + ' · ' + t('help') }),
        ]),
      );
      app.appendChild(h('div', { class: 'grid' }, tiles));
      app.appendChild(
        h('div', {}, [
          h('h2', { text: '🚨 ' + t('emergency') }),
          h('div', { class: 'sos' }, [
            h('a', { class: 'btn red', href: 'tel:112' }, [ico('🚓'), '112']),
            h('a', { class: 'btn red', href: 'tel:108' }, [ico('🚑'), '108 · ' + t('ambulance')]),
          ]),
          h('p', { class: 'foot' }, [
            t('by'),
            ' · ',
            h('a', { href: G.website, target: '_blank', rel: 'noopener', text: t('website') }),
          ]),
        ]),
      );
    },

    restaurants: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: '🍴' }));
      app.appendChild(h('h1', { text: t('restaurants') }));
      app.appendChild(h('div', { class: 'note', text: t('restNote') }));
      app.appendChild(h('h2', { text: t('deliveryApps') }));
      app.appendChild(
        h('div', { class: 'row2' }, [
          h('a', { class: 'btn', href: G.swiggy, target: '_blank', rel: 'noopener' }, [
            ico('🛵'),
            'Swiggy',
          ]),
          h('a', { class: 'btn red', href: G.zomato, target: '_blank', rel: 'noopener' }, [
            ico('🍽️'),
            'Zomato',
          ]),
        ]),
      );
      app.appendChild(h('div', { style: 'height:10px' }));
      app.appendChild(
        h('a', { class: 'btn ghost', href: G.mapsRestaurants, target: '_blank', rel: 'noopener' }, [
          ico('📍'),
          t('restOnMap'),
        ]),
      );
      app.appendChild(h('h2', { text: t('restCall') }));
      var vegOnly = false;
      var list = h('div', { class: 'stack' }, [h('p', { class: 'lead', text: t('refreshing') })]);
      var data = null;
      var chips = h('div', { class: 'chips' });
      function paintChips() {
        chips.textContent = '';
        [
          [false, t('restAll')],
          [true, t('restVeg')],
        ].forEach(function (c) {
          chips.appendChild(
            h(
              'button',
              {
                class: 'chip' + (vegOnly === c[0] ? ' on' : ''),
                onclick: function () {
                  vegOnly = c[0];
                  paintChips();
                  paintList();
                },
              },
              [c[1]],
            ),
          );
        });
      }
      function dietLabel(d) {
        return d === 'veg'
          ? '🟢 ' + t('dietVeg')
          : d === 'nonveg'
            ? '🔴 ' + t('dietNonveg')
            : '🟠 ' + t('dietMixed');
      }
      function paintList() {
        list.textContent = '';
        if (data === null) return;
        var rows = data.filter(function (r) {
          return !vegOnly || r.diet === 'veg';
        });
        if (!rows.length) {
          list.appendChild(h('p', { class: 'lead', text: t('restNone') }));
          list.appendChild(
            h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [
              ico('📞'),
              t('callReception'),
            ]),
          );
          return;
        }
        rows.forEach(function (r) {
          var acts = [];
          if (r.phone)
            acts.push(
              h('a', { class: 'btn green', href: 'tel:' + r.phone }, [
                ico('📞'),
                t('call') + ' ' + showPhone(r.phone),
              ]),
            );
          if (r.menu_url)
            acts.push(
              h('a', { class: 'btn gold', href: r.menu_url, target: '_blank', rel: 'noopener' }, [
                ico('📖'),
                t('menu'),
              ]),
            );
          list.appendChild(
            h('div', { class: 'card rest' }, [
              h('div', { class: 'rest-head' }, [
                h('b', { text: r.name }),
                h('span', { class: 'diet', text: dietLabel(r.diet) }),
              ]),
              r.cuisine ? h('div', { class: 'rest-line', text: r.cuisine }) : null,
              r.area ? h('div', { class: 'rest-line', text: '📍 ' + r.area }) : null,
              r.hours ? h('div', { class: 'rest-line', text: '🕐 ' + r.hours }) : null,
              r.note ? h('div', { class: 'rest-note', text: r.note }) : null,
              h('div', { class: 'stack', style: 'margin-top:12px' }, acts),
            ]),
          );
        });
        list.appendChild(h('p', { class: 'foot', text: t('restConfirm') }));
      }
      paintChips();
      app.appendChild(chips);
      app.appendChild(list);
      post({ action: 'info', room: guest.room, name: guest.name })
        .then(function (r) {
          data = r.restaurants || [];
          paintList();
        })
        .catch(function () {
          list.textContent = '';
          list.appendChild(h('p', { class: 'lead', text: t('failed') }));
          list.appendChild(
            h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [
              ico('📞'),
              t('callReception'),
            ]),
          );
        });
    },

    explore: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: '🗺️' }));
      app.appendChild(h('h1', { text: t('explore') }));
      app.appendChild(h('p', { class: 'lead', text: t('exploreLead') }));
      var tab = exploreTab;
      var focusId = null;
      var seg = h('div', { class: 'seg', role: 'tablist' });
      var body = h('div');
      function paintSeg() {
        seg.textContent = '';
        [
          ['trip', '🗓️', t('tabTrip')],
          ['places', '🖼️', t('tabPlaces')],
          ['map', '📍', t('tabMap')],
        ].forEach(function (x) {
          seg.appendChild(
            h(
              'button',
              {
                class: 'segb' + (tab === x[0] ? ' on' : ''),
                role: 'tab',
                'aria-selected': String(tab === x[0]),
                onclick: function () {
                  show(x[0], null);
                },
              },
              [ico(x[1]), x[2]],
            ),
          );
        });
      }
      function show(next, id) {
        tab = next;
        exploreTab = next;
        focusId = id;
        paintSeg();
        body.textContent = '';
        if (tab === 'trip') tripView(body);
        else if (tab === 'places') tilesView(body);
        else mapView(body, focusId);
      }
      app.appendChild(seg);
      app.appendChild(body);
      show(tab, null);
    },

    wifi: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: '📶' }));
      app.appendChild(h('h1', { text: t('wifiTitle') }));
      var box = h('div', { class: 'card' }, [h('p', { class: 'lead', text: t('refreshing') })]);
      app.appendChild(box);
      post({ action: 'info', room: guest.room, name: guest.name })
        .then(function (r) {
          var i = r.info || {};
          box.textContent = '';
          if (!i.wifi_name && !i.wifi_password) {
            box.appendChild(h('p', { class: 'lead', text: t('wifiNone') }));
            box.appendChild(
              h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [
                ico('📞'),
                t('callReception'),
              ]),
            );
            return;
          }
          if (i.wifi_name)
            box.appendChild(
              h('div', { class: 'kv' }, [
                h('small', { text: t('wifiName') }),
                h('div', { class: 'v', text: i.wifi_name }),
              ]),
            );
          if (i.wifi_password) {
            box.appendChild(
              h('div', { class: 'kv' }, [
                h('small', { text: t('wifiPass') }),
                h('div', { class: 'v', text: i.wifi_password }),
              ]),
            );
            box.appendChild(
              h(
                'button',
                {
                  class: 'btn gold',
                  onclick: function () {
                    copy(i.wifi_password);
                  },
                },
                [ico('📋'), t('copy')],
              ),
            );
          }
        })
        .catch(function () {
          box.textContent = '';
          box.appendChild(h('p', { class: 'lead', text: t('failed') }));
          box.appendChild(
            h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [
              ico('📞'),
              t('callReception'),
            ]),
          );
        });
    },

    info: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: 'ℹ️' }));
      app.appendChild(h('h1', { text: t('infoTitle') }));
      var box = h('div', { class: 'card' });
      function kv(label, value) {
        box.appendChild(
          h('div', { class: 'kv' }, [
            h('small', { text: label }),
            h('div', { class: 'v', style: 'font-size:1.1rem', text: value }),
          ]),
        );
      }
      kv(t('address'), G.address);
      app.appendChild(box);
      post({ action: 'info', room: guest.room, name: guest.name })
        .then(function (r) {
          var i = r.info || {};
          if (i.checkout_time) kv(t('checkout'), i.checkout_time);
          if (i.note) kv(t('moreInfo'), i.note);
        })
        .catch(function () {});
      app.appendChild(
        h('div', { class: 'stack', style: 'margin-top:14px' }, [
          h('a', { class: 'btn', href: G.maps, target: '_blank', rel: 'noopener' }, [
            ico('🗺️'),
            t('maps'),
          ]),
          h('a', { class: 'btn ghost', href: G.website, target: '_blank', rel: 'noopener' }, [
            ico('🌐'),
            t('website'),
          ]),
          h('a', { class: 'btn ghost', href: G.instagram, target: '_blank', rel: 'noopener' }, [
            ico('📷'),
            t('instagram'),
          ]),
        ]),
      );
    },

    mine: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: '📋' }));
      app.appendChild(h('h1', { text: t('mineTitle') }));
      var list = h('div');
      app.appendChild(list);
      function ago(iso) {
        var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
        if (m < 1) return t('justNow');
        if (m < 60) return m + t('min') + t('ago');
        return Math.round(m / 60) + t('hr') + t('ago');
      }
      function refresh() {
        post({ action: 'mine', room: guest.room, name: guest.name })
          .then(function (r) {
            list.textContent = '';
            if (!r.requests || !r.requests.length) {
              list.appendChild(h('p', { class: 'lead', text: t('mineEmpty') }));
              return;
            }
            r.requests.forEach(function (q) {
              var icon = (SERVICES[q.kind] && SERVICES[q.kind].icon) || '🙋';
              list.appendChild(
                h('div', { class: 'req' }, [
                  h('span', { class: 'ic', 'aria-hidden': 'true', text: icon }),
                  h('div', { class: 't' }, [
                    h('b', { text: t('k_' + q.kind) }),
                    h('small', { text: (q.item ? q.item + ' · ' : '') + ago(q.created_at) }),
                  ]),
                  h('span', { class: 'badge ' + q.status, text: t('st_' + q.status) }),
                ]),
              );
            });
          })
          .catch(function () {
            list.textContent = '';
            list.appendChild(h('p', { class: 'lead', text: t('failed') }));
          });
      }
      refresh();
      timer = setInterval(refresh, 15000);
      app.appendChild(h('div', { style: 'height:8px' }));
      app.appendChild(callRow());
    },

    review: function () {
      app.appendChild(backBtn());
      app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: '⭐' }));
      app.appendChild(h('h1', { text: t('reviewTitle') }));
      app.appendChild(h('p', { class: 'lead', text: t('reviewLead') }));
      var vals = { overall: 0, cleanliness: 0, staff: 0, comfort: 0 };
      function stars(key) {
        var wrap = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': t(key) });
        function paint() {
          Array.prototype.forEach.call(wrap.children, function (b, i) {
            b.className = 'star' + (i < vals[key] ? ' on' : '');
            b.setAttribute('aria-checked', String(i + 1 === vals[key]));
          });
        }
        for (var i = 1; i <= 5; i++) {
          (function (n) {
            wrap.appendChild(
              h('button', {
                class: 'star',
                role: 'radio',
                'aria-label': n + ' / 5',
                text: '★',
                onclick: function () {
                  vals[key] = n;
                  paint();
                },
              }),
            );
          })(i);
        }
        paint();
        return wrap;
      }
      var comment = h('textarea', {
        id: 'comment',
        placeholder: t('commentHint'),
        maxlength: '1000',
      });
      var hp = h('input', {
        class: 'hp',
        type: 'text',
        name: 'company',
        tabindex: '-1',
        autocomplete: 'off',
        'aria-hidden': 'true',
      });
      var send = h(
        'button',
        {
          class: 'btn',
          onclick: function () {
            if (!vals.overall) {
              toast(t('needStars'), true);
              return;
            }
            send.disabled = true;
            send.textContent = t('sending');
            var ratings = {};
            ['cleanliness', 'staff', 'comfort'].forEach(function (k) {
              if (vals[k]) ratings[k] = vals[k];
            });
            post({
              action: 'review',
              room: guest.room,
              name: guest.name,
              rating: vals.overall,
              ratings: ratings,
              comment: comment.value.trim(),
              company: hp.value,
              started_at: loadedAt,
            })
              .then(function () {
                app.textContent = '';
                app.appendChild(
                  h('div', { class: 'card done' }, [
                    h('div', { class: 'check', 'aria-hidden': 'true', text: '🙏' }),
                    h('h1', { text: t('thanks') }),
                    h('p', { class: 'lead', text: t('thanksSub') }),
                    h(
                      'button',
                      {
                        class: 'btn',
                        onclick: function () {
                          go('home');
                        },
                      },
                      [t('home')],
                    ),
                  ]),
                );
              })
              .catch(function () {
                send.disabled = false;
                send.textContent = t('submit');
                toast(t('failed'), true);
              });
          },
        },
        [t('submit')],
      );
      app.appendChild(
        h('div', { class: 'card' }, [
          h('div', { style: 'text-align:center;font-weight:800' }, [t('overall')]),
          stars('overall'),
          h('div', { class: 'starrow' }, [
            h('span', { text: t('cleanliness') }),
            stars('cleanliness'),
          ]),
          h('div', { class: 'starrow' }, [h('span', { text: t('staff') }), stars('staff')]),
          h('div', { class: 'starrow' }, [h('span', { text: t('comfort') }), stars('comfort')]),
          h('label', { for: 'comment', text: t('comment') }),
          comment,
          hp,
          h('div', { style: 'height:14px' }),
          send,
        ]),
      );
    },
  };

  // A service screen: big option buttons, an optional note, one Send button.
  function serviceScreen(kind) {
    var s = SERVICES[kind];
    picked = {};
    app.appendChild(backBtn());
    app.appendChild(h('div', { class: 'pageicon', 'aria-hidden': 'true', text: s.icon }));
    app.appendChild(h('h1', { text: t(kind) }));
    if (s.note) app.appendChild(h('div', { class: 'note', text: t(s.note) }));
    if (kind === 'food')
      app.appendChild(
        h(
          'button',
          {
            class: 'btn gold',
            style: 'margin-bottom:14px',
            onclick: function () {
              go('restaurants');
            },
          },
          [ico('🍴'), t('orderOnline')],
        ),
      );
    if (s.opts.length) {
      app.appendChild(h('p', { class: 'lead', text: t('pick') }));
      var grid = h('div', { class: 'opts' });
      s.opts.forEach(function (o) {
        var b = h(
          'button',
          {
            class: 'opt',
            'aria-pressed': 'false',
            onclick: function () {
              picked[o[0]] = !picked[o[0]];
              b.setAttribute('aria-pressed', String(!!picked[o[0]]));
            },
          },
          [ico(o[1]), h('span', { text: t('o_' + o[0]) })],
        );
        grid.appendChild(b);
      });
      app.appendChild(grid);
    }
    var note = h('textarea', { id: 'note', placeholder: t('anythingHint'), maxlength: '500' });
    var hp = h('input', {
      class: 'hp',
      type: 'text',
      name: 'company',
      tabindex: '-1',
      autocomplete: 'off',
      'aria-hidden': 'true',
    });
    app.appendChild(h('label', { for: 'note', text: t('anything') }));
    app.appendChild(note);
    app.appendChild(hp);
    var send = h(
      'button',
      {
        class: 'btn',
        onclick: function () {
          var items = s.opts
            .filter(function (o) {
              return picked[o[0]];
            })
            .map(function (o) {
              return T.en['o_' + o[0]];
            });
          var text = note.value.trim();
          if (!items.length && !text) {
            toast(t('pickOrType'), true);
            return;
          }
          send.disabled = true;
          send.textContent = t('sending');
          post({
            action: 'request',
            room: guest.room,
            name: guest.name,
            kind: kind,
            item: items.join(', '),
            details: text,
            company: hp.value,
            started_at: loadedAt,
          })
            .then(function () {
              sent(kind);
            })
            .catch(function () {
              send.disabled = false;
              send.textContent = t('send');
              toast(t('failed'), true);
            });
        },
      },
      [ico('✅'), t('send')],
    );
    app.appendChild(h('div', { style: 'height:14px' }));
    app.appendChild(send);
    app.appendChild(callRow());
  }

  function sent() {
    app.textContent = '';
    app.appendChild(
      h('div', { class: 'card done' }, [
        h('div', { class: 'check', 'aria-hidden': 'true', text: '✅' }),
        h('h1', { text: t('sent') }),
        h('p', { class: 'lead', text: t('sentSub') }),
        h('div', { class: 'stack' }, [
          h(
            'button',
            {
              class: 'btn',
              onclick: function () {
                go('mine');
              },
            },
            [ico('📋'), t('seeMine')],
          ),
          h(
            'button',
            {
              class: 'btn ghost',
              onclick: function () {
                go('home');
              },
            },
            [t('home')],
          ),
        ]),
        h('p', { class: 'lead', style: 'margin-top:16px', text: t('sentSlow') }),
        h('a', { class: 'btn green', href: telLink(G.reception.phone) }, [
          ico('📞'),
          t('callReception'),
        ]),
      ]),
    );
    window.scrollTo(0, 0);
  }

  function copy(text) {
    function ok() {
      toast(t('copied'));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, ok);
    } else {
      var ta = h('textarea', { class: 'hp' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing to do */
      }
      document.body.removeChild(ta);
      ok();
    }
  }

  // ---------- top bar ----------
  document.getElementById('brand').addEventListener('click', function () {
    go(ready() ? 'home' : 'welcome');
  });
  whoBtn.addEventListener('click', function () {
    editing = true;
    go('welcome');
  });
  langBtn.addEventListener('click', function () {
    lang = lang === 'hi' ? 'en' : 'hi';
    save('sv_lang', lang);
    route();
  });
  window.addEventListener('hashchange', function () {
    editing = (location.hash || '').slice(1) === 'welcome' && editing;
    route();
  });
  route();
})();
