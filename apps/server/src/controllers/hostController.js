export const getPayouts = (_req, res) => {
  res.json({
    data: [
      {
        reference: "JS-HST100",
        gross: 301000,
        commission: 30100,
        net: 270900,
        status: "paid",
      },
      {
        reference: "JS-HST101",
        gross: 260000,
        commission: 26000,
        net: 234000,
        status: "scheduled",
      },
      {
        reference: "JS-HST102",
        gross: 181000,
        commission: 18100,
        net: 162900,
        status: "on_hold",
      },
    ],
    sampleData: true,
    totals: { gross: 742000, net: 667800, currency: "NGN" },
  });
};
