const request = require('request-promise-native');
const express = require('express');
const app = express();
const cheerio = require('cheerio');

const baseUrl = 'https://supremecommunity.com';

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


let lastGetProducts = {};
let lastGetDrops = new Date();

let drops = [];
let products = {};

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}


async function get (url) {
  const data = await request(`${baseUrl}${url}`);
  return cheerio.load(data);
}

async function getDropList() {
  const $ = await get('/season/latest/droplists/');
  return Array.from($('.block').map((i, x) => ({
    url: x.attribs.href,
    name: $(x).text().trim(),
    slug: slugify($(x).text().trim())
  })));
}

async function getProducts(url) {
  const $ = await get(url);
  const cards = $('.card-details');
  return Array.from(cards.map((i, card) => {
    const imageUrl = `${baseUrl}/${$(card).find('img')[0].attribs.src}`;
    let name = $($(card).find('.name')[0]).text().trim();
    const price = $($(card).find('.label-price')[0]).text().trim();
    name = name.replace(/[\/®]/g, ' ');
    return {imageUrl, name, price, keywords: name.split(' ').filter(x => !!x)};
  }));
}


async function updateDrops() {
  try {
    drops = await getDropList();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function updateProducts(dropSlug) {
  try {
    const drop = drops.find(x => x.slug === dropSlug);
    if (!drop) return false;
    products[dropSlug] = await getProducts(drop.url);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

app.get('/drops', async (req, res) => {
  const now = new Date();
  const diffMinutes = ((now.getTime() - lastGetDrops.getTime()) / 1000) / 60;
  if (diffMinutes >= 10) {
    lastGetDrops = now;
    await updateDrops();
  }
  res.json(drops);
});

app.get('/drops/:slug/products/', async (req, res) => {
  const slug = req.params.slug;
  if (!slug) res.status(404);
  const drop = drops.find(x => x.slug === slug);
  if (!drop) res.status(404);

  const now = new Date();
  let lastGet = lastGetProducts[slug];
  if (!lastGet) lastGet = now;
  const diffMinutes = ((now.getTime() - lastGet.getTime()) / 1000) / 60;

  if (!products[slug] || diffMinutes >= 10) {
    lastGetProducts[slug] = now;
    await updateProducts(slug);
  }
  return res.json(products[slug]);
});

async function start() {
  await updateDrops();
  console.log('server listening on port 8081');
  app.listen(8081);
}
start();
