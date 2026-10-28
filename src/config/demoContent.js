/**
 * DEMO CONTENT — edit freely.
 *
 * Everything in this file is fictional sample content used by the simulated
 * apps inside the hologram. None of it is fetched from, or sent to, any real
 * service. Contacts, posts and messages are illustrative only.
 *
 * Images are generated procedurally at runtime (see src/uicanvas/images.js);
 * `img` fields are seeds/themes for that generator: 'sunset', 'city', 'ocean',
 * 'forest', 'aurora', 'desert', 'abstract', 'tech', 'food', 'mountain'.
 */

export const DEMO_CONTENT = {
  device: {
    name: 'PHANTOM S23',
    carrier: 'PHANTOM',
    battery: 87,
    signal: 4,
    wifi: true,
    locale: 'de-DE',
  },

  facebook: {
    /** Public profile URL opened in a normal browser tab ("Live profile" mode). */
    profileUrl: 'https://www.facebook.com/mahmoud.hasan.428535',
    /** Shown on the simulated profile. Replace with the details you are entitled to show. */
    displayName: 'Mahmoud Hasan',
    subtitle: 'Profile preview · sample content',
    bio: 'Edit this text in src/config/demoContent.js',
    details: ['Lives in — (edit me)', 'Works at — (edit me)'],
    friendsLabel: '— friends',
    /** Show a small "SAMPLE" tag on posts so nothing is mistaken for real published content. */
    showSampleBadge: true,
    posts: [
      { time: 'Sample · 2 h', text: 'Sample post: first look at the holographic interface concept.', img: 'tech', likes: 128, comments: 14, shares: 3 },
      { time: 'Sample · Yesterday', text: 'Sample post: evening light over the city.', img: 'city', likes: 342, comments: 27, shares: 9 },
      { time: 'Sample · 3 d', text: 'Sample post without image — edit the text in demoContent.js.', likes: 57, comments: 6, shares: 1 },
      { time: 'Sample · 1 w', text: 'Sample post: weekend trip.', img: 'mountain', likes: 211, comments: 18, shares: 4 },
    ],
  },

  whatsapp: {
    /** Auto-reply after you send a message (clearly simulated; set to [] to disable). */
    autoReplies: ['Looks amazing! 🔥', 'Wow, is that a hologram?', 'Send me the video later 👍', 'Haha, nice!'],
    chats: [
      {
        id: 'wa-lena', name: 'Lena Fischer', color: '#3fb6a8', unread: 2, time: '09:41',
        messages: [
          { from: 'them', text: 'Hey! Did the new phone arrive?', time: '09:38' },
          { from: 'me', text: 'Yes, just unboxed it 😄', time: '09:39', status: 'read' },
          { from: 'them', text: 'And?? Show me!', time: '09:40' },
          { from: 'them', text: 'Is the screen really floating? 😮', time: '09:41' },
        ],
      },
      {
        id: 'wa-team', name: 'Studio Team', color: '#6c8cff', unread: 5, time: '09:12', group: true,
        messages: [
          { from: 'them', author: 'Jonas', text: 'Shoot starts at 11:00', time: '08:55' },
          { from: 'them', author: 'Mira', text: 'Lights are ready 💡', time: '09:05' },
          { from: 'me', text: 'On my way', time: '09:10', status: 'read' },
          { from: 'them', author: 'Jonas', text: 'Bring the S23!', time: '09:12' },
        ],
      },
      {
        id: 'wa-david', name: 'David Klein', color: '#e0a142', unread: 0, time: 'Yesterday',
        messages: [
          { from: 'me', text: 'Thanks for yesterday!', time: '21:02', status: 'read' },
          { from: 'them', text: 'Anytime 🙌', time: '21:05' },
        ],
      },
      {
        id: 'wa-sara', name: 'Sara Nowak', color: '#d46a9a', unread: 0, time: 'Mon',
        messages: [
          { from: 'them', text: 'Coffee on Friday?', time: '14:20' },
          { from: 'me', text: 'Perfect ☕', time: '14:22', status: 'read' },
        ],
      },
      {
        id: 'wa-mama', name: 'Mama', color: '#8bc34a', unread: 1, time: 'Sun',
        messages: [{ from: 'them', text: 'Call me when you have time ❤️', time: '18:30' }],
      },
    ],
  },

  messages: {
    chats: [
      {
        id: 'sms-bank', name: 'PHANTOM Service', color: '#4aa3ff', unread: 1, time: '08:02',
        messages: [{ from: 'them', text: 'Welcome to your new PHANTOM S23. This is a simulated SMS.', time: '08:02' }],
      },
      {
        id: 'sms-tom', name: 'Tom Becker', color: '#ff8a65', unread: 0, time: 'Yesterday',
        messages: [
          { from: 'them', text: 'Are we still on for tonight?', time: '17:44' },
          { from: 'me', text: 'Yes, 8 pm!', time: '17:46', status: 'delivered' },
        ],
      },
      {
        id: 'sms-parcel', name: 'Parcel Info', color: '#9575cd', unread: 0, time: 'Tue',
        messages: [{ from: 'them', text: 'Your parcel is out for delivery (sample message).', time: '10:15' }],
      },
    ],
  },

  youtube: {
    /** Optional real link opened externally from the video detail view. */
    externalUrl: 'https://www.youtube.com/',
    videos: [
      { title: 'Holographic Interfaces Explained in 10 Minutes', channel: 'Future Lab', views: '1.2M views', age: '3 days ago', duration: '10:24', img: 'tech' },
      { title: 'Night City Timelapse 4K — Sample', channel: 'Urban Frames', views: '842K views', age: '1 week ago', duration: '6:02', img: 'city' },
      { title: 'Northern Lights Above the Fjords', channel: 'Nordic Sky', views: '3.4M views', age: '2 months ago', duration: '14:51', img: 'aurora' },
      { title: 'Ocean Sounds for Deep Focus', channel: 'Calm Waves', views: '5.9M views', age: '1 year ago', duration: '1:02:00', img: 'ocean' },
      { title: 'Desert Road Trip — Cinematic Edit', channel: 'Wander', views: '411K views', age: '5 days ago', duration: '8:37', img: 'desert' },
      { title: 'Street Food Tour (Sample Video)', channel: 'Taste Map', views: '2.1M views', age: '3 weeks ago', duration: '18:09', img: 'food' },
    ],
  },

  instagram: {
    username: 'phantom.creator',
    posts: [
      { user: 'nordic.lights', place: 'Tromsø', img: 'aurora', likes: 4821, caption: 'Sky on fire tonight ✨ (sample)' },
      { user: 'urban.frames', place: 'Berlin', img: 'city', likes: 1290, caption: 'Blue hour never disappoints (sample)' },
      { user: 'calm.waves', place: 'Algarve', img: 'ocean', likes: 3377, caption: 'Salt in the air 🌊 (sample)' },
      { user: 'taste.map', place: 'Istanbul', img: 'food', likes: 902, caption: 'Breakfast goals (sample)' },
    ],
    stories: ['you', 'lena.f', 'urban', 'nordic', 'calm', 'taste'],
  },

  phone: {
    recents: [
      { name: 'Lena Fischer', time: 'Today 09:20', type: 'in' },
      { name: 'Studio Team', time: 'Yesterday', type: 'out' },
      { name: '+49 30 0000 0000', time: 'Mon', type: 'missed' },
    ],
  },
};
