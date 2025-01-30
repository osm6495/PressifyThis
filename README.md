# PressifyThis

Pressify this is a news article viewer that works completely in your browser. No
more ads or paywalls or links to other articles covering the entire screen.

## How it works

When you upload a link, the browser sends a request to a third party service,
archive.ph, which stores archived versions of a large number of websites. By
accessing the archived version, paywalls can usually be bypassed and it also
helps to avoid some technical issues with cross-origin resource sharing.

Once we get the archived version of the site, we can use Mozilla's incredible
Readability package to pull out only the content and ignore any ads or
navigation text.

## No ads?

I am providing this service open source. Since the work is all done in your
browser there are no maintenance or compute costs, and because it's practically
free to host and deploy and the code is open source, if the site is taken down
for any reason it will be very easy to make your own.

All of this was built to avoid the need for ads at all, and to make sure this
service can easily remain up for everyone. If you do appreciate my work on this
though and want to support me and my future projects, you can donate of become a
GitHub sponsor here: https://github.com/sponsors/osm6495

## Usage

To make your own version of the site, just fork the repo and deploy it or just
run it locally on your machine by following the following steps:

### Install NPM and Vite

You can follow this guide to install npm:
https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

This guide will help you install vite: https://vite.dev/guide/

### Run the site locally

```bash
git clone https://github.com/osm6495/PressifyThis
cd PressifyThis
vite run dev
```

You can also fork this repo and clone down the fork instead. Once this step is
complete, click on the link to localhost or copy and paste it into the url bar
and you will see the site in your browser.
