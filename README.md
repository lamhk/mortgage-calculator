# mortgage-calculator
Simple mortgage calculator website

## ASN enquiry

Serve the static site over HTTP or HTTPS and open asn-analysis.html. Choose a complete
[CAIDA serial-1 relationships snapshot](https://data.caida.org/datasets/as-relationships/serial-1/)
(extract the bzip2 archive first) and the matching
[AS Organizations snapshot](https://data.caida.org/datasets/as-organizations/)
(gzip or plain text). Files are processed locally in a worker and are not uploaded.

The CAIDA archive endpoints do not allow cross-origin browser fetches from this site.
CAIDA's [public dataset agreement](https://www.caida.org/about/legal/aua/public_aua)
grants a limited, non-transferable license and requires attribution and reporting of
publications using the data. The repository does not ship raw or preprocessed snapshots.
Confirm redistribution rights and publication obligations with CAIDA before hosting a
public snapshot. AS Rank exposes customer links and provider counts, but is not a
verified equivalent bulk source for the complete provider ASN lists and serial-1
snapshot semantics used here.
