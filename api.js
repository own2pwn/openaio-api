const request = require('request-promise-native');
const express = require('express');
const app = express();
const cheerio = require('cheerio');
const cached = require('./cache');
const utils = require('./utils');

const baseCommunityUrl = 'https://supremecommunity.com';
const baseSupremeUrl = 'http://supremenewyork.com';

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

async function get (url) {
  const data = await request(url);
  return cheerio.load(data);
}

async function getDropList() {
  const $ = await get(`${baseCommunityUrl}/season/latest/droplists/`);
  return Array.from($('.block').map((i, x) => ({
    url: x.attribs.href,
    name: $(x).text().replace(/\s\s+/g, ' ').trim(),
    slug: utils.slugify($(x).text().trim())
  })));
}

async function getSupremeCategories() {
  const $ = await get(`${baseSupremeUrl}/shop/all`);
  return Array.from($('#nav-categories a').map((i, x) => (
    {
      label: $(x).text().trim(),
      name: x.attribs.href.substr(x.attribs.href.lastIndexOf('/') + 1),
    })))
    .filter(x => ['new', 'all'].indexOf(x.name) === -1);
}

async function getSupremeProducts(category) {
  const $ = await get(`${baseSupremeUrl}/shop/all/${category}`);
  return Array.from($('article').map((i, x) => ({
    url: $(x).find('a')[0].attribs.href,
    name: $($(x).find('h1')[0]).text(),
    color: $($(x).find('p')[0]).text(),
    soldOut: $(x).find('.sold_out_tag').length >= 1,
  })));
}

async function getProducts(url) {
  const $ = await get(baseCommunityUrl + url);
  const cards = $('.card');
  return Array.from(cards.map((i, card) => {
    const imageUrl = `${baseCommunityUrl}/${$(card).find('img')[0].attribs.src}`;
    let name = $($(card).find('.name')[0]).text().trim();
    const price = $($(card).find('.label-price')[0]).text().trim();
    const category = $($(card).find('.category')[0]).text().replace(/\s\s+/g, ' ').trim();
    name = name.replace(/\s\s+/g, ' ').trim();
    return {imageUrl, name, price, keywords: name.split(' ').filter(x => !!x), category};
  }));
}

const getProductsCached = cached(getProducts, 10);
const getDropsCached = cached(getDropList, 10);
const getCategoriesCached = cached(getSupremeCategories, 0.10);
const getSupremeProductsCached = cached(getSupremeProducts, 0.10);

app.get('/categories', async (req, res) => {
  res.json(await getCategoriesCached());
});

app.get('/categories/:name/products', async (req, res) => {
  const name = req.params.name;
  const categories = await getCategoriesCached();
  const category = categories.find(x => x.name === name);
  if (!category) {
    return res.sendStatus(404);
  }

  return res.json(await getSupremeProductsCached(category.name));
});

app.get('/drops', async (req, res) => {
  res.json(await getDropsCached());
});

app.get('/drops/:slug/products/', async (req, res) => {
  const drops = await getDropsCached();
  const slug = req.params.slug;
  if (!slug) return res.sendStatus(404);
  const drop = drops.find(x => x.slug === slug);
  if (!drop) return res.sendStatus(404);

  return res.json(await getProductsCached(drop.url));
});

console.log('server listening on port 8081');
app.listen(8081);
