const request = require('request-promise-native');
const express = require('express');
const app = express();
const cheerio = require('cheerio');
const cached = require('./cache');
const utils = require('./utils');

const baseUrl = 'https://supremecommunity.com';

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

async function get (url) {
  const data = await request(`${baseUrl}${url}`);
  return cheerio.load(data);
}

async function getDropList() {
  const $ = await get('/season/latest/droplists/');
  return Array.from($('.block').map((i, x) => ({
    url: x.attribs.href,
    name: $(x).text().replace(/\s\s+/g, ' ').trim(),
    slug: utils.slugify($(x).text().trim())
  })));
}

async function getProducts(url) {
  const $ = await get(url);
  const cards = $('.card');
  return Array.from(cards.map((i, card) => {
    const imageUrl = `${baseUrl}/${$(card).find('img')[0].attribs.src}`;
    let name = $($(card).find('.name')[0]).text().trim();
    const price = $($(card).find('.label-price')[0]).text().trim();
    const category = $($(card).find('.category')[0]).text().replace(/\s\s+/g, ' ').trim();
    name = name.replace(/\s\s+/g, ' ').trim();
    return {imageUrl, name, price, keywords: name.split(' ').filter(x => !!x), category};
  }));
}

const getProductsCached = cached(getProducts, 10);
const getDropsCached = cached(getDropList, 10);


app.get('/drops', async (req, res) => {
  res.json(await getDropsCached());
});

app.get('/drops/:slug/products/', async (req, res) => {
  const drops = await getDropsCached();
  const slug = req.params.slug;
  if (!slug) res.status(404);
  const drop = drops.find(x => x.slug === slug);
  if (!drop) res.status(404);

  return res.json(await getProductsCached(drop.url));
});

console.log('server listening on port 8081');
app.listen(8081);
