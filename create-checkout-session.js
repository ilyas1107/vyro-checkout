const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SITE_URL = 'https://urban-ore-wise-echo-u3dglpc4m7cclvv6g.paged.net';

const PRODUCTS = {
  'Jogging Floral': 2500,
  'Hoodie Floral': 4000,
  'Ensemble Hoodie & Jogging': 5000,
  'Ensemble T-shirt & Short': 3000,
  'Hoodie Graffiti': 3000,
  'Short Graffiti': 2399,
  'Short Print': 2000
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;

    // Si Vercel reçoit le corps comme texte
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    let cart = body?.cart;

    // Notre site envoie le panier comme une chaîne JSON
    if (typeof cart === 'string') {
      cart = JSON.parse(cart);
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Panier vide' });
    }

    const line_items = cart.map(item => {
      const unit_amount = PRODUCTS[item.name];
      const quantity = Number(item.quantity);

      if (
        !unit_amount ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        throw new Error('Article ou quantité invalide');
      }

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${item.name} — ${item.color} — Taille ${item.size}`
          },
          unit_amount
        },
        quantity
      };
    });

    const subtotal = line_items.reduce(
      (sum, item) =>
        sum + item.price_data.unit_amount * item.quantity,
      0
    );

    const shippingAmount = subtotal >= 8000 ? 0 : 300;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['FR']
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: shippingAmount,
              currency: 'eur'
            },
            display_name:
              shippingAmount === 0
                ? 'Livraison offerte'
                : 'Livraison'
          }
        }
      ],
      success_url: `${SITE_URL}/?paiement=succes`,
      cancel_url: `${SITE_URL}/?paiement=annule`
    });

    // Si le site utilise un formulaire classique,
    // on redirige directement vers Stripe.
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      return res.redirect(303, session.url);
    }

    // Sinon, réponse JSON normale
    return res.status(200).json({
      url: session.url
    });

  } catch (error) {
    console.error(error);

    return res.status(400).json({
      error: error.message || 'Erreur Stripe'
    });
  }
};
