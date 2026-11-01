// Case studies for the six market modes.
// Figures were checked against news and reference sources (listed per entry).
// Index levels differ slightly between sources (intraday vs closing), so the
// "note" field says where that matters. Spot-check anything you publish
// against the exchange data (BSE, NSE, S&P, Nasdaq).

export const caseStudies = {
  bull: [
    {
      title: "India bull run, 2003 to January 2008",
      period: "2003 - 10 Jan 2008",
      figures: [
        "Sensex low of about 2,904 in 2003",
        "Record high of 21,206.77 on 10 Jan 2008",
        "Roughly a seven-fold rise in about five years",
        "11 days later (21 Jan 2008) it fell 1,408 points, or 7.4%, in one day",
        "The 2008 peak was only regained in 2013",
      ],
      lesson:
        "Strong growth and foreign money fed a long rally, and a global shock ended it quickly.",
      note: "The start level depends on which 2003 low you pick (about 2,900 to 5,800).",
      confidence: "high",
      sources: [
        "https://www.business-standard.com/amp/article/markets/sensex-may-regain-21-000-levels-report-109040800147_1.html",
        "https://www.business-standard.com/article/specials/india-at-75-16-events-that-impacted-indian-markets-between-2003-and-2014-122081100006_1.html",
        "https://www.outlookindia.com/business/taurean-rush-news-282684",
      ],
    },
    {
      title: "Post-COVID rally in India, 2020 to 2021",
      period: "24 Mar 2020 - 19 Oct 2021",
      figures: [
        "Nifty low of 7,511 on 24 Mar 2020",
        "Doubled to 15,000 in 219 sessions",
        "Passed its pre-COVID high in November 2020",
        "Record high of 18,604.45 on 19 Oct 2021",
      ],
      lesson:
        "Cheap money, stimulus and strong earnings can drive a rally that starts right after a crash.",
      note: "Intraday figures. The 23 Mar 2020 closing level was 7,610.",
      confidence: "high",
      sources: [
        "https://www.angelone.in/news/share-market/nifty50-touches-a-record-high-from-7511-to-19000-here-is-the-detailed-journey",
        "https://www.bloombergquint.com/markets/nifty-at-15000-doubles-from-march-low-in-charts",
        "https://zee5.com/articles/?p=6733152",
      ],
    },
  ],

  normal: [
    {
      title: "US sideways market, 1966 to 1982",
      period: "Jan 1966 - 1982",
      figures: [
        "The Dow reached about 990 in January 1966",
        "It did not permanently stay above 1,000 until 1982",
        "Cumulative US inflation over the period was about 207%",
        "Inside the range there were several big swings (roughly 600 to 1,000)",
      ],
      lesson:
        "Sideways does not mean calm. Prices went nowhere while inflation quietly shrank real returns.",
      note: "The S&P 500 did better than the Dow (about 6.8% a year, nominal). Estimates of the inflation-adjusted loss vary between sources, so use the inflation figure rather than a single loss number.",
      confidence: "medium",
      sources: [
        "https://awealthofcommonsense.com/2014/06/1966-1982-stock-market-really-bad/",
        "https://www.resilience.org/stories/2025-07-20/stocks-only-go-up-until-they-dont-a-history-lesson-and-a-forecast/",
        "https://www.fool.com/investing/general/2012/10/11/the-dow-breaks-2-bears-in-1-day.aspx",
      ],
    },
  ],

  correction: [
    {
      title: "US fourth-quarter selloff, 2018",
      period: "20 Sep - 24 Dec 2018",
      figures: [
        "S&P 500 fell 19.3% from its 20 Sep high to the 24 Dec low",
        "Full-year 2018 return was about -4.4%, the first down year since 2008",
        "It rebounded 13.7% by 18 Jan 2019",
        "Drivers named: Fed rate hikes, the US-China trade war, slowing growth fears",
      ],
      lesson:
        "A pullback driven by worry rather than panic. It also shows how a correction can come close to a bear market and still recover.",
      note: "This one sits right on the border. Some measures count it as a bear market on an intraday basis. For a textbook correction, the average since World War II is about 13.7% over roughly four months, with about four months to recover.",
      confidence: "medium",
      sources: [
        "https://www.etftrends.com/?p=289685",
        "https://seekingalpha.com/article/4231460-2018-year-charts",
        "https://www.nbcboston.com/news/national-international/how-long-stock-market-corrections-last-how-bad-they-can-get/",
      ],
    },
  ],

  crash: [
    {
      title: "COVID crash, US, 2020",
      period: "19 Feb - 23 Mar 2020",
      figures: [
        "S&P 500 fell from 3,386.15 to 2,237.40, a drop of about 33.9%",
        "It took 33 calendar days, the fastest fall into a bear market on record",
        "Entered bear market territory in 16 trading days",
      ],
      lesson:
        "Panic plus uncertainty can hit everything at once, and fast.",
      confidence: "high",
      sources: [
        "https://benzinga.com/z/44669291",
        "https://www.pbs.org/newshour/economy/sp-500-closes-at-a-record-erasing-last-of-pandemic-losses",
        "https://www.fool.com/investing/2021/02/19/the-coronavirus-stock-market-crash-1-year-later",
      ],
    },
    {
      title: "COVID crash, India, 23 March 2020",
      period: "23 Mar 2020",
      figures: [
        "Sensex fell 3,934.72 points, or 13.15%, to close at 25,981.24",
        "Its worst single day ever",
        "Trading halted after a 10% fall within minutes of the open",
        "Sensex was down about 38.8% from its 20 Jan 2020 peak of 42,273.8",
        "Nifty closed at 7,610",
      ],
      lesson:
        "Lockdown fears hit every sector, and the circuit breaker stopped trading to slow the panic.",
      confidence: "high",
      sources: [
        "https://www.business-standard.com/amp/article/pti-stories/market-bleeds-sensex-nifty-post-worst-ever-one-day-crash-120032300935_1.html",
        "https://www.businesstoday.in/markets/stocks/story/sbe-nse-sensex-worst-day-in-history-crashes-252759-2020-03-23",
        "https://etvbharat.com/english/business/markets/market-crash-know-key-points/na20200323175155748",
      ],
    },
    {
      title: "Black Monday, 19 October 1987",
      period: "19 Oct 1987",
      figures: [
        "Dow fell 508 points, or 22.6%, to 1,738, its worst one-day percentage fall",
        "S&P 500 fell about 20.5% the same day",
        "Blamed partly on program trading and portfolio insurance creating a selling spiral",
        "The market still ended 1987 slightly up",
      ],
      lesson:
        "Automated selling can feed on itself, and a crash does not always mean a long recession.",
      note: "One source gave a 30% S&P figure for the day, which conflicts with the others, so it was left out.",
      confidence: "high",
      sources: [
        "https://www.benzinga.com/general/education/21/10/12533659/this-day-in-market-history-black-monday-1987",
        "https://www.yahoo.com/news/black-monday-why-wall-street-122817964.html",
        "https://fffinstill.com/learning/lessons/black-monday-1987",
      ],
    },
  ],

  recovery: [
    {
      title: "Rebound after the 2008 financial crisis",
      period: "Mar 2009 onward",
      figures: [
        "S&P 500 fell about 57% from its Oct 2007 peak (1,565.15) to 676.53",
        "Intraday low of 666.79 on 6 Mar 2009, closing low on 9 Mar 2009",
        "It jumped 6.4% the next day",
        "Up more than 60% within about six months",
        "The bull market that followed ran about 11 years, until March 2020",
      ],
      lesson:
        "Recoveries start when the news is still terrible, and they begin with sharp bounces.",
      confidence: "high",
      sources: [
        "https://benzinga.com/z/44669291",
        "https://vnews.com/?p=186557",
        "https://thereformedbroker.com/?p=44484",
      ],
    },
    {
      title: "India after the 2008 crash",
      period: "Oct 2008 - 2009",
      figures: [
        "Sensex fell about 64% from 21,000 (Jan 2008) to about 8,500 (Oct 2008)",
        "It regained 15,000 by July 2009 and added about 80% during 2009",
        "The January 2008 peak was only passed again in 2013",
      ],
      lesson:
        "A quick bounce is not the same as a full recovery to the old high.",
      confidence: "medium",
      sources: [
        "https://www.businesstoday.in/amp/markets/market-perspective/story/sensex-hits-50000-index-rose-9000-in-over-34-year-roller-coaster-ride-285127-2021-01-21",
        "https://www.business-standard.com/article/specials/india-at-75-16-events-that-impacted-indian-markets-between-2003-and-2014-122081100006_1.html",
      ],
    },
    {
      title: "Fastest recovery on record, US, 2020",
      period: "23 Mar - 18 Aug 2020",
      figures: [
        "S&P 500 regained its pre-COVID high on 18 Aug 2020, about five months after the low",
        "The 1987 crash took about 20 months to recover",
      ],
      lesson:
        "Heavy government and central bank support can shorten a recovery a lot.",
      confidence: "high",
      sources: [
        "https://fa-mag.com/news/the-second-year-of-the-bull-market-begins-61047.html",
        "https://www.pbs.org/newshour/economy/sp-500-closes-at-a-record-erasing-last-of-pandemic-losses",
      ],
    },
  ],

  bubble: [
    {
      title: "Dot-com bubble, 1995 to 2002",
      period: "1995 - Oct 2002",
      figures: [
        "Nasdaq Composite peaked on 10 Mar 2000 at 5,048.62 (5,132.52 intraday)",
        "It rose about 86% in 1999 alone",
        "By October 2002 it had fallen roughly 77-78% (low near 1,114)",
        "It did not regain the 2000 peak until 2015",
      ],
      lesson:
        "Excitement about a real technology pushed prices far past what companies earned. Many firms vanished, though a few (Amazon, eBay) survived.",
      note: "The fall is quoted as 76.8% to 78% depending on the low date and whether you use closing or intraday values. The gain from 1995 is quoted from 400% to about 580%, so avoid that number unless you pick one source.",
      confidence: "high",
      sources: [
        "https://www.goldmansachs.com/our-firm/history/moments/2000-dot-com-bubble",
        "https://www.fa-mag.com/news/tech-valuations-are-back-in-focus-on-anniversary-of-dot-com-peak-66797.html",
        "https://internationalbanker.com/history-of-financial-crises/the-dotcom-bubble-burst-2000/",
      ],
    },
    {
      title: "Harshad Mehta securities scam, India, 1992",
      period: "Apr 1991 - Aug 1992",
      figures: [
        "Sensex rose from 1,194 to 4,467 in a year (about +274%)",
        "The scam was exposed on 23 Apr 1992 in a Times of India article by Sucheta Dalal",
        "On 28 Apr 1992 the Sensex fell 570 points (12.77%) to 3,870",
        "It reached 2,529 by August 1992, about 43% below the peak",
        "Funds diverted from banks were estimated at about Rs 4,000 crore",
      ],
      lesson:
        "Not every bubble is a natural mania. This one was inflated by borrowed bank money, and it collapsed when the source of funds was exposed.",
      note: "It is more of a manipulated boom than a classic bubble. A few sources quote bigger one-day falls (20%) or declines (73%) that do not match news records, so those were left out. The quadruple figure I gave earlier was too high: it is about 3.7x over a year.",
      confidence: "medium",
      sources: [
        "https://www.money9.com/news/equities/indian-financial-markets-in-the-aftermath-of-harshad-mehta-headlined-securities-scam-31045.html",
        "https://www.businesstoday.in/magazine/focus/story/year-1992-round-up-20965-2011-01-03",
        "https://www.marketcalls.in/?p=56792",
      ],
    },
  ],
};

// Sector divergence example (lower confidence: from a single aggregator).
// In March 2020 airlines fell sharply while video-conferencing (Zoom) rose a lot.
// Verify exact figures against a primary source before showing them.
export const sectorDivergence = {
  title: "COVID 2020: some sectors fell while others soared",
  note: "Reported figures: Zoom from about $68 to $588, airlines down 60-70%. Treat as approximate until checked.",
  confidence: "low",
  sources: ["https://fffinstill.com/learning/concepts/covid-19-market-crash-2020"],
};