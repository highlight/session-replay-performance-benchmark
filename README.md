# Session Replay Performance Benchmark

At highlight.io, our first product was an open-source session replay tool built on [rrweb](https://github.com/rrweb-io/rrweb). Session Replay enables our customers to replay user sessions to analyze performance regressions and understand how users interact with a site.

Despite the benefits, as our customer base grew, more and more teams asked about the performance implications of using this technology on their site. After all, additional computation must happen to record exactly what is shown in the browser. In this post, we'll discuss the overhead of session replay with respect to resource consumption and interaction latency in several scenarios.

It is important to note that we did not measure Web Vitals, as these metrics can easily be manipulated by changing when javascript is executed on the client. Instead, we focused on metrics that affect the browser while session replay records data. If you’re interested in trying out the experiment detailed below or want to learn more about how it works, you can find it [here](https://github.com/highlight/session-replay-performance-benchmark).

## Running the Benchmark

```bash
yarn;
yarn start;
```

Result `.csv` files will appear in `replay-perf-puppet/results/`.
