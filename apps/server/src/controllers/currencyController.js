import { formatNaira } from "@josstay/shared";

export const convertCurrency = (req, res) => {
  const amount = Number(req.params.amount);
  if (Number.isNaN(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  res.json({
    ngn: formatNaira(amount),
    usd: `$${Math.round(amount / 1550).toLocaleString("en-US")}`,
    rate: 1550,
  });
};
