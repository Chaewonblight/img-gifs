function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return String.fromCharCode(...bytes);
}

function hexToB64(hex) {
  return btoa(hexToBytes(hex))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';

  // 🔐 Signed URL validation
  const e = url.searchParams.get('e');
  const token = url.searchParams.get('token');

  if (e && token) {
    const now = Math.floor(Date.now() / 1000);

    if (now > parseInt(e)) {
      return new Response("Expired", { status: 403 });
    }

    const cleanUrl = url.origin + url.pathname;
    const expected = btoa(cleanUrl + e + "secret123").replace(/=/g, '');

    if (token !== expected) {
      return new Response("Invalid token", { status: 403 });
    }
  }

  // 🔹 Root protection
  if (pathname === '/' || pathname === '/index.json') {
    if (userAgent.includes('Mozilla')) {
      return Response.redirect('https://www.github.com/404', 302);
    } else {
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 🔐 PLAYLIST
  if (pathname === '/playlist.m3u8') {
    const accessKey = url.searchParams.get('key');
    const auth = url.searchParams.get('auth');

    // 🔥 STRICT Accept filter (stronger)
    const isValidAccept =
      accept.includes('application/vnd.apple.mpegurl') ||
      accept === '*/*';

    const isAuthorized =
      accessKey === 'bastikwang123' &&
      auth === 'iptv-client' &&
      isValidAccept;

    // ❌ Fake playlist
    if (!isAuthorized) {
      return new Response(`#EXTM3U\n#EXTINF:-1,Access Denied\n`, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store'
        }
      });
    }

    // ✅ REAL PLAYLIST
    let m3u = `#EXTM3U x-tvg-url="${data.provider.epg}"\n`;

    data.channels.forEach(channel => {
      const group = data.categories[channel.category]?.name || 'Other';

      m3u += `#EXTINF:-1 tvg-id="${channel.epg_id || ''}" tvg-logo="${channel.icon || ''}" group-title="${group}",${channel.name}\n`;

      if (channel.url.includes('.mpd') && channel.drm_type === 'clearkey') {
        const [kid, key] = channel.drm_key.split(':');
        const kid_b64 = hexToB64(kid);
        const key_b64 = hexToB64(key);

        m3u += `#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`;
        m3u += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
        m3u += `#KODIPROP:inputstream.adaptive.license_key=${kid}:${key}\n`;

        const clearkeyJson = JSON.stringify({
          keys: [{ kty: "oct", k: key_b64, kid: kid_b64 }]
        });

        m3u += `#EXTVLCOPT:license-type=clearkey\n`;
        m3u += `#EXTVLCOPT:license-key=${clearkeyJson}\n`;
      }

      if (channel.headers) {
        Object.entries(channel.headers).forEach(([k, v]) => {
          m3u += `#EXTVLCOPT:http-${k.toLowerCase()}=${v}\n`;

          if (k.toLowerCase() === 'user-agent') {
            m3u += `#EXTHTTP:{"User-Agent":"${v}"}\n`;
          }
        });
      }

      // 🔥 EXPIRING STREAM LINKS
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 25;

      const clean = new URL(channel.url);
      const base = clean.origin + clean.pathname;

      const sign = btoa(base + expiry + "secret123").replace(/=/g, '');

      const finalUrl = `${base}?e=${expiry}&token=${sign}`;

      m3u += `${finalUrl}\n`;
    });

    return new Response(m3u, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store'
      }
    });
  }

  return new Response("Not Found", { status: 404 });
}

const data = {
  provider: {
    user_message: "Welcome to SnapVision!!!",
    epg: "https://epg.freejptv.com/jp.xml"
  },

  categories: {
    local: { name: "🇵🇭 𝘓𝘰𝘤𝘢𝘭" },
    jungo: { name: "🟡 𝘑𝘶𝘯𝘨𝘰" },
    news: { name: "📰 𝘕𝘦𝘸𝘴 𝘢𝘯𝘥 𝘐𝘯𝘧𝘰𝘳𝘮𝘢𝘵𝘪𝘰𝘯" },
    genent: { name: "🎬 𝘌𝘯𝘵𝘦𝘳𝘵𝘢𝘪𝘯𝘮𝘦𝘯𝘵" },
    kids: { name: "🧸 𝘒𝘪𝘥𝘴 𝘢𝘯𝘥 𝘍𝘢𝘮𝘪𝘭𝘺" },
    documentary: { name: "🪐 𝘋𝘰𝘤𝘶𝘮𝘦𝘯𝘵𝘢𝘳𝘺" },
    music: { name: "🎶 𝘔𝘶𝘴𝘪𝘤" },
    int: { name: "🌄 𝘍𝘰𝘳𝘦𝘪𝘨𝘯" },
    sport: { name: "🏆 𝘚𝘱𝘰𝘳𝘵𝘴" },
    hbo: { name: "🎞 𝘏𝘉𝘖 𝘗𝘢𝘤𝘬" },
    discovery: { name: "🌐 𝘋𝘪𝘴𝘤𝘰𝘷𝘦𝘳𝘺 𝘗𝘢𝘤𝘬" }
  },

  channels: [
    {
      category: "music",
      epg_id: "musicbox",
      name: "MusicBOX",
      icon: "https://i.ibb.co/20vC0pHV/musicbox-vn.png",
      drm_type: "clearkey",
      drm_key: "a7c942778e874d43be92b8d0a0cd11b4:6d54358306571658ffdb952c6560688b",
      url: "https://livevlisctcdnw.seenow.vn/livesnv2/MUSICBOX/manifest.mpd"
    },
    {
      category: "music",
      epg_id: "mtv",
      name: "MTV Japan",
      icon: "https://i.ibb.co/N2P0Ct0K/mtvtw.png",
      url: "https://nl.utako.moe/mtv/index.m3u8"
    },
    {
      category: "music",
      epg_id: "Music.Dummy.us",
      name: "Hallypop",
      icon: "https://i.ibb.co/9k9D8bNm/hallypop.png",
      drm_type: "clearkey",
      drm_key: "",
      url: "http://136.239.173.26:6610/001/2/ch00000090990000001152/manifest.mpd?AuthInfo=v87HD9rEhwHiAdYyrP20Tg5pgSMSITY%2FHYvvCWJRp%2BrQQqEzMGzqacd7xs%2FVYEXbytokK1MIobcue1ImXa0ZEA%3D%3D&version=v1.0&BreakPoint=0&virtualDomain=001.live_hls.zte.com&programid=ch00000000000000001373&contentid=ch00000000000000001373&videoid=ch00000090990000001152&recommendtype=0&userid=1181864451786&boid=001&stbid=02%3A00%3A00%3A00%3A00%3A00&terminalflag=1&profilecode=&usersessionid=9VC3RX5W7QLXXX&NeedJITP=1&JITPMediaType=DASH&JITPDRMType=NO"
    },
  ]
};    const cleanUrl = url.origin + url.pathname;
    const expected = btoa(cleanUrl + e + "secret123").replace(/=/g, '');

    if (token !== expected) {
      return new Response("Invalid token", { status: 403 });
    }
  }

  // 🔹 Root protection
  if (pathname === '/' || pathname === '/index.json') {
    if (userAgent.includes('Mozilla')) {
      return Response.redirect('https://www.github.com/404', 302);
    } else {
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 🔐 PLAYLIST
  if (pathname === '/playlist.m3u8') {
    const accessKey = url.searchParams.get('key');
    const auth = url.searchParams.get('auth');

    // 🔥 STRICT Accept filter (stronger)
    const isValidAccept =
      accept.includes('application/vnd.apple.mpegurl') ||
      accept === '*/*';

    const isAuthorized =
      accessKey === 'bastikwang123' &&
      auth === 'iptv-client' &&
      isValidAccept;

    // ❌ Fake playlist
    if (!isAuthorized) {
      return new Response(`#EXTM3U\n#EXTINF:-1,Access Denied\n`, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store'
        }
      });
    }

    // ✅ REAL PLAYLIST
    let m3u = `#EXTM3U x-tvg-url="${data.provider.epg}"\n`;

    data.channels.forEach(channel => {
      const group = data.categories[channel.category]?.name || 'Other';

      m3u += `#EXTINF:-1 tvg-id="${channel.epg_id || ''}" tvg-logo="${channel.icon || ''}" group-title="${group}",${channel.name}\n`;

      if (channel.url.includes('.mpd') && channel.drm_type === 'clearkey') {
        const [kid, key] = channel.drm_key.split(':');
        const kid_b64 = hexToB64(kid);
        const key_b64 = hexToB64(key);

        m3u += `#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`;
        m3u += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
        m3u += `#KODIPROP:inputstream.adaptive.license_key=${kid}:${key}\n`;

        const clearkeyJson = JSON.stringify({
          keys: [{ kty: "oct", k: key_b64, kid: kid_b64 }]
        });

        m3u += `#EXTVLCOPT:license-type=clearkey\n`;
        m3u += `#EXTVLCOPT:license-key=${clearkeyJson}\n`;
      }

      if (channel.headers) {
        Object.entries(channel.headers).forEach(([k, v]) => {
          m3u += `#EXTVLCOPT:http-${k.toLowerCase()}=${v}\n`;

          if (k.toLowerCase() === 'user-agent') {
            m3u += `#EXTHTTP:{"User-Agent":"${v}"}\n`;
          }
        });
      }

      // 🔥 EXPIRING STREAM LINKS
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 25;

      const clean = new URL(channel.url);
      const base = clean.origin + clean.pathname;

      const sign = btoa(base + expiry + "secret123").replace(/=/g, '');

      const finalUrl = `${base}?e=${expiry}&token=${sign}`;

      m3u += `${finalUrl}\n`;
    });

    return new Response(m3u, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store'
      }
    });
  }

  return new Response("Not Found", { status: 404 });
}

const data = {
  provider: {
    user_message: "Welcome to SnapVision!!!",
    epg: "https://epg.freejptv.com/jp.xml"
  },

  categories: {
    local: { name: "🇵🇭 𝘓𝘰𝘤𝘢𝘭" },
    jungo: { name: "🟡 𝘑𝘶𝘯𝘨𝘰" },
    news: { name: "📰 𝘕𝘦𝘸𝘴 𝘢𝘯𝘥 𝘐𝘯𝘧𝘰𝘳𝘮𝘢𝘵𝘪𝘰𝘯" },
    genent: { name: "🎬 𝘌𝘯𝘵𝘦𝘳𝘵𝘢𝘪𝘯𝘮𝘦𝘯𝘵" },
    kids: { name: "🧸 𝘒𝘪𝘥𝘴 𝘢𝘯𝘥 𝘍𝘢𝘮𝘪𝘭𝘺" },
    documentary: { name: "🪐 𝘋𝘰𝘤𝘶𝘮𝘦𝘯𝘵𝘢𝘳𝘺" },
    music: { name: "🎶 𝘔𝘶𝘴𝘪𝘤" },
    int: { name: "🌄 𝘍𝘰𝘳𝘦𝘪𝘨𝘯" },
    sport: { name: "🏆 𝘚𝘱𝘰𝘳𝘵𝘴" },
    hbo: { name: "🎞 𝘏𝘉𝘖 𝘗𝘢𝘤𝘬" },
    discovery: { name: "🌐 𝘋𝘪𝘴𝘤𝘰𝘷𝘦𝘳𝘺 𝘗𝘢𝘤𝘬" }
  },

  channels: [
    {
      category: "music",
      epg_id: "musicbox",
      name: "MusicBOX",
      icon: "https://i.ibb.co/20vC0pHV/musicbox-vn.png",
      drm_type: "clearkey",
      drm_key: "a7c942778e874d43be92b8d0a0cd11b4:6d54358306571658ffdb952c6560688b",
      url: "https://livevlisctcdnw.seenow.vn/livesnv2/MUSICBOX/manifest.mpd"
    },
    {
      category: "music",
      epg_id: "mtv",
      name: "MTV Japan",
      icon: "https://i.ibb.co/N2P0Ct0K/mtvtw.png",
      url: "https://nl.utako.moe/mtv/index.m3u8"
    },
    {
      category: "music",
      epg_id: "musicbox",
      name: "CineCanal",
      icon: "https://i.ibb.co/cSnW52vk/cinecanal.png",
      drm_type: "clearkey",
      drm_key: "cc0425ceb09de724085204043a0a3ab9:0f4d10ed85da0a04851d703951234f1c",
      url: "https://covoslivechannels2dash.clarovideo.com/Content/DASH_DASH_FK/Live/Channel(CINECANAL_HD)/manifest.mpd"
    },
  ]
};
