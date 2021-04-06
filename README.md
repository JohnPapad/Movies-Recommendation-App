# Movies-Recommendation-App

A web app that provides movie recommendations, based on already watched movie ratings, using collaborative filtering.  
At first, the user has to rate at least 5 movies  and then 10 movie recommendations will be presented. Recommendations update every 3 new ratings, or when the user rates one of the recommended movies.  
The [Pearson correlation coefficient](https://en.wikipedia.org/wiki/Pearson_correlation_coefficient) was used.


## Stack

- Express (Node.js)
- SQLite
- JavaScript

> The app implements a RESTful architecture.

## How to run locally

```
~$ node index.js
```
> Navigate to [localhost:3000](http://127.0.0.1:3000)
