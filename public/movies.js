window.addEventListener(
    'load',
    () => {
        const MOVIES_API_URL = "http://35.198.145.30:3000/";
        let fetchedMoviesById = {};  // {movieId: <all movie info>} - used for caching
        let userMovieRatings = {};   // {moviedId: <rating>} 
        let otherUsersMovieRatings = {}; // {userId: [<highest_rating_movieId> ...]} - used for caching
        let moviesRatings = {}; // {moviedId: { usersIds: [<userId>...], moviesRatings: [<rating>...]}} - used for caching
        let recommendedMoviesById = new Set();
        let newRatedMoviesN = 0;
        let currentPage = 1;
        let moviesResultsIds = [];

        let searchTimeout;
        document.getElementById("movie-query").addEventListener('keydown', () => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            searchTimeout = setTimeout(fetchMoviesByTitle, 250); // don't send request as long as the user is typing
        });


        const fetchMoviesByTitle = () => {
            document.getElementById("pagination").innerHTML = "";
            document.getElementById("movies-search-note").innerHTML = "";
            const movieQuery = document.getElementById("movie-query").value;
            if (movieQuery.trim() === "" || movieQuery.length < 3) {
                document.getElementById("movies-search-results").innerHTML = "";
                return;
            }

            fetch(MOVIES_API_URL + "movie", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ "keyword": movieQuery })
            }).then(response => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' + response.status);
                    return;
                }
                return response.json(); // get the payload
            }).then(data => {
                if (!data || data.length === 0) {
                    //delete table
                    document.getElementById("movies-search-results").innerHTML = "";
                    return;
                }
                
                moviesResultsIds = [];
                data.forEach(movie => {
                    const movieId = movie["movieId"]
                    fetchedMoviesById[movieId] = movie; // cache fetched movies
                    moviesResultsIds.push(movieId);
                });  

                if (moviesResultsIds.length <= 10) {
                    renderMoviesTable(moviesResultsIds);  // render all the movie results
                }
                else {
                    renderMoviesTable(moviesResultsIds.slice(0, 10)); // render only the first 10 movies 
                }
                document.getElementById("movies-search-note").innerHTML = `${moviesResultsIds.length} movies were found`
                createPaginationButtons();

            }).catch(err => console.log('Fetch Error :-S', err)); // deal with error 

        }


        const fetchMovieById = (movieId, moviesTableNode) => {
            fetch(MOVIES_API_URL + "movie/" + movieId, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(response => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' + response.status);
                    return;
                }
                return response.json(); // get the payload
            }).then(data => {
                if (!data || data.length === 0) {
                    return;
                }
                const movie = data[0];
                fetchedMoviesById[movie["movieId"]] = movie;  // cache fetched movie
                createMovieTr(movie, moviesTableNode);

            }).catch(err => console.log('Fetch Error :-S', err)); // deal with error 
        }


        const renderMoviesTable = (moviesIds) => {

            let moviesTable = renderMoviesTableHeader();
            moviesIds.forEach(movieId => { 
                const movie = fetchedMoviesById[movieId];
                moviesTable += renderMovieTr(movie["movieId"], movie["title"], movie["genres"]);
            });
            document.getElementById("movies-search-results").innerHTML = moviesTable;

            moviesIds.forEach(movieId => {
                document.getElementById(`rating-movieId-${movieId}`).addEventListener('change', (e) => {
                    rating = Number(e.target.value);
                    onChangeRatingHandler(movieId, rating);
                });
            });
        }


        const renderMoviesTableHeader = () => {
            return `
                <tr>
                    <th>
                        #
                    </th>
                    <th>
                        Title
                    </th>
                    <th>
                        Genres
                    </th>
                    <th>
                        Personal Rating
                    </th>
                </tr>`;
        }


        const renderMovieTr = (movieId, movieTitle, movieGenres, isRecommended) => {
            let selectId = `rating-movieId-${movieId}`;
            if (isRecommended) {
                selectId = `recommended-rating-movieId-${movieId}`;
            }
            return `
                <tr>
                    <td>${movieId}</td>
                    <td>${movieTitle}</td>
                    <td>${movieGenres.replace(/\|/g, ", ")}</td>
                    <td>
                        <select id="${selectId}" name="rating">
                            <option value="5" ${calcRatingSelectedTag(movieId, 5)}>5</option>
                            <option value="4" ${calcRatingSelectedTag(movieId, 4)}>4</option>
                            <option value="3" ${calcRatingSelectedTag(movieId, 3)}>3</option>
                            <option value="2" ${calcRatingSelectedTag(movieId, 2)}>2</option>
                            <option value="1" ${calcRatingSelectedTag(movieId, 1)}>1</option>
                            <option value="0" ${!(movieId in userMovieRatings) ? "selected" : ""}>unrated</option>
                        </select>
                    </td>
                </tr>`
        }


        const calcRatingSelectedTag = (movieId, rating) => {
            return (movieId in userMovieRatings) && userMovieRatings[movieId] === rating ? "selected" : "";
        }


        const onChangeRatingHandler = (movieId, rating) => {
            if (!(rateMovie(movieId, rating))) {
                return;
            }

            document.getElementById("recommended-movies-note").innerHTML = "Updating movie recommendations ..."
            document.getElementById("recommended-movies-results").innerHTML = "";
            createLoadingSpinner();

            const userRatedMoviesIds = Object.keys(userMovieRatings);
            
            let movieIdsToFetch = [];
            let cachedMoviesRatingsIds = [];
            userRatedMoviesIds.forEach(movieId => {
                if (!(movieId in moviesRatings)){  // movie's ratings have not been cached locally
                    movieIdsToFetch.push(movieId);   // ratings for this movie will be fetched from server
                }
                else {
                    cachedMoviesRatingsIds.push(movieId);  // movie's ratings are cached locally and do not need to be fetched from server
                }
            });

            console.log("-> onChangeRatingHandler function: ")
            console.log("-> New movie Ids to be fetched: ", movieIdsToFetch);
            console.log("-> Cached movie Ids (no need to be fetched again): ", cachedMoviesRatingsIds);
            console.log("--------------------------------");

            if (movieIdsToFetch.length === 0){
                // if there is no movieId rating to fetch skip the HTTP request to server                    
                let ratingsByUser = {}; // {userId: {movieIds: [<movieId>...] , movieRatings: [<rating>...]}}
                extractCachedMoviesRatingsByUser(cachedMoviesRatingsIds, ratingsByUser);
                mostSimilarUserId = collaborativeFiltering(getOtherUserIdsForCollaborativeFiltering(ratingsByUser), ratingsByUser);
                console.log("-> Most similar user Id: ", mostSimilarUserId);
                extractSimilarMoviesFromOtherUser(mostSimilarUserId);
            }
            else{
                fetchMoviesRatings(movieIdsToFetch, cachedMoviesRatingsIds);
            }
        }   
        

        const rateMovie = (movieId, rating) => {
            // return true if it's time to fetch (new) recommended movies, false otherwise
            if (rating === 0) {
                delete userMovieRatings[movieId];
                newRatedMoviesN--;
                if (newRatedMoviesN < 0) {
                    newRatedMoviesN = 0
                }
            }
            else {
                if (recommendedMoviesById.has(movieId)) {
                    // one of the recommended movies was rated, thus recommendations need updating to exclude this one
                    userMovieRatings[movieId] = rating;
                    recommendedMoviesById.delete(movieId);
                    return true;
                }

                if (!(movieId in userMovieRatings)) {
                    newRatedMoviesN++;
                } 

                userMovieRatings[movieId] = rating;
                if (recommendedMoviesById.size !== 0) {
                    // recommendations have been proposed
                    if (newRatedMoviesN >= 3) {
                        newRatedMoviesN = 0;
                        return true;
                    }
                }
                else if (Object.keys(userMovieRatings).length === 5) {
                    // no recommendations have been made yet
                    // it's time to enable recommendations - first 5 movies have been rated by the user
                    newRatedMoviesN = 0;
                    return true;
                }
            }
            updateRecommendedMoviesNote();
            return false;
        }


        const updateRecommendedMoviesNote = () => {
            const numOfUserRatings = Object.keys(userMovieRatings).length;
            if (recommendedMoviesById.size === 0) {
                // no recommended movies have been proposed
                document.getElementById("recommended-movies-note").innerHTML = `You have to rate at least ${5-numOfUserRatings} movies first in order to enable recommendations`;
            }
            else {
                document.getElementById("recommended-movies-note").innerHTML = `You have to rate at least ${3-newRatedMoviesN} new movies in order to update recommendations`;
            }
        }


        const fetchMoviesRatings = (movieIdsToFetch, cachedMoviesRatingsIds) => {
            fetch(MOVIES_API_URL + "ratings", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({"movieList": movieIdsToFetch})
            }).then(response => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' + response.status);
                    return;
                }
                return response.json(); // get the payload
            }).then(data => {
                if (!data || data.length === 0) {
                    return;
                }

                let ratingsByUser = {}; // {userId: {movieIds: [<movieId>...] , movieRatings: [<rating>...]}} 
                data.forEach(movieRatingInfo => {  
                    const movieId = movieRatingInfo["movieId"];
                    const movieRating = Math.ceil(Number(movieRatingInfo["rating"]));
                    const userId = movieRatingInfo["userId"];
                    
                    // cache movie ratings by movieId
                    if (!(movieId in moviesRatings)) {
                        moviesRatings[movieId] = {
                            usersIds: [],
                            moviesRatings: []
                        };
                    }
                    moviesRatings[movieId]["usersIds"].push(userId);
                    moviesRatings[movieId]["moviesRatings"].push(movieRating);

                    // extract ratings by userId
                    if (!(userId in ratingsByUser)) {
                        ratingsByUser[userId] = {
                            moviesIds: [],
                            moviesRatings: []
                        };
                    }
                    ratingsByUser[userId]["moviesIds"].push(movieId);
                    ratingsByUser[userId]["moviesRatings"].push(movieRating);

                }); 
                
                extractCachedMoviesRatingsByUser(cachedMoviesRatingsIds, ratingsByUser);
                mostSimilarUserId = collaborativeFiltering(getOtherUserIdsForCollaborativeFiltering(ratingsByUser), ratingsByUser);
                console.log("-> Most similar user Id: ", mostSimilarUserId);
                extractSimilarMoviesFromOtherUser(mostSimilarUserId);

            }).catch(err => console.log('Fetch Error :-S', err)); // deal with error 
        }


        extractCachedMoviesRatingsByUser = (cachedMoviesRatingsIds, ratingsByUser) => {
            // append cached movies ratings to ratingsByUser
            cachedMoviesRatingsIds.forEach(movieId => {   // takes advantage from cached movies ratings 
                const movieRatingInfo = moviesRatings[movieId]; 
                const movieRatingInfoLength = movieRatingInfo["moviesRatings"].length;

                for (let i = 0; i < movieRatingInfoLength; i++) {
                    const userId = movieRatingInfo["usersIds"][i];
                    const movieRating = movieRatingInfo["moviesRatings"][i];

                    if (!(userId in ratingsByUser)) {
                        ratingsByUser[userId] = {
                            moviesIds: [],
                            moviesRatings: []
                        };
                    }
                    ratingsByUser[userId]["moviesIds"].push(movieId);
                    ratingsByUser[userId]["moviesRatings"].push(movieRating);
                }
            });
        }


        getOtherUserIdsForCollaborativeFiltering = (ratingsByUser) => { 
            // sorts ratingsByUser based on the number of user's movie ratings
            return Object.keys(ratingsByUser).sort((userId1, userId2) => ratingsByUser[userId2]["moviesRatings"].length - ratingsByUser[userId1]["moviesRatings"].length);
        }


        collaborativeFiltering = (otherUsersIdsSorted, ratingsByUser) => {
            // finds and returns the userId that has the most similarity with the current user, based on the correlation coefficient

            let prevUserNumOfRatings = -1; // bigger is better
            let biggestUserCorrelation = -9999; // bigger is better
            let mostSimilarUserId = null;
            const userNumOfRatings = Object.keys(userMovieRatings).length;
            const otherUsersIdsSortedLength = otherUsersIdsSorted.length;

            for (let i = 0; i < otherUsersIdsSortedLength; i++) {
                // checking other users for similarity based on ratings' similarity (regarding the same movies)
                // starting with those who have rated (seen) the most same movies with the user
                const otherUserId = otherUsersIdsSorted[i];

                const otherUserRatings = ratingsByUser[otherUserId]["moviesRatings"];
                const otherUserNumOfRatings = otherUserRatings.length;
                const otherUserMoviesIds = ratingsByUser[otherUserId]["moviesIds"];

                if (otherUserNumOfRatings < prevUserNumOfRatings) {
                    // this user has rated less movies than the previous (has seen less same movies with the user)
                    // thus no need to continue checking for correlation co-efficiency
                    break;
                }

                tmpUserMoviesRatings = [];
                if (otherUserNumOfRatings !== userNumOfRatings) {
                    // the other user has rated less movies, thus some movie ratings will be excluded from the correlation co-efficiency calculation
                    for (j = 0; j < otherUserNumOfRatings; j++) {
                        const otherUserMovieId = otherUserMoviesIds[j];
                        if (otherUserMovieId in userMovieRatings) {
                            //keep only the same ones
                            tmpUserMoviesRatings.push(userMovieRatings[otherUserMovieId]);
                        }

                        if (tmpUserMoviesRatings.length === otherUserNumOfRatings) {
                            break;
                        }
                    }
                }
                else {
                    tmpUserMoviesRatings = Object.values(userMovieRatings);
                }
                prevUserNumOfRatings = otherUserNumOfRatings;

                const pearsonCorrelation = getPearsonCorrelation(tmpUserMoviesRatings, otherUserRatings);
                if (pearsonCorrelation >= biggestUserCorrelation) {
                    biggestUserCorrelation = pearsonCorrelation;
                    mostSimilarUserId = otherUserId;
                }
                
            }

            return mostSimilarUserId;
        }


        getPearsonCorrelation = (x, y) => {
            // calculating the pearson correlation co-efficiency for the movie ratings (same movies) of 2 users
            const shortestArrayLength = Math.min(x.length, y.length);
        
            let xy = [];
            let x2 = [];
            let y2 = [];
        
            for(let i = 0; i < shortestArrayLength; i++) {
                xy.push(x[i] * y[i]);
                x2.push(x[i] * x[i]);
                y2.push(y[i] * y[i]);
            }
        
            let sum_x = 0;
            let sum_y = 0;
            let sum_xy = 0;
            let sum_x2 = 0;
            let sum_y2 = 0;
        
            for(let i = 0; i < shortestArrayLength; i++) {
                sum_x += x[i];
                sum_y += y[i];
                sum_xy += xy[i];
                sum_x2 += x2[i];
                sum_y2 += y2[i];
            }
        
            const step1 = (shortestArrayLength * sum_xy) - (sum_x * sum_y);
            const step2 = (shortestArrayLength * sum_x2) - (sum_x * sum_x);
            const step3 = (shortestArrayLength * sum_y2) - (sum_y * sum_y);
            const step4 = Math.sqrt(step2 * step3);
            let result = 0;
            if (step4 !== 0){
                result = step1 / step4;
            }
        
            return result;
        }


        extractSimilarMoviesFromOtherUser = (userId) => {
            if (userId in otherUsersMovieRatings) {
                // this user's top highest movies have been cached - no need to refetch this user's all ratings
                let movieIdsToFetch = [];
                const similarMovieIds = otherUsersMovieRatings[userId];
                const numOfSimilarMovieIds = similarMovieIds.length;
                for (let i = 0; i < numOfSimilarMovieIds; i++){
                    const movieId = similarMovieIds[i];
                    if (!(movieId in userMovieRatings)) {
                        // recommended movie must have not been rated (watched) by the user  
                        movieIdsToFetch.push(movieId);
                        if (movieIdsToFetch.length === 10) {
                            // only needing the top 10 highest rated movies 
                            break;
                        }
                    }
                }

                if (movieIdsToFetch.length < 10){
                    // need to recalculate the top highest rated movies of the particular user
                    console.log("-> Most similar user's top rated movies have been cached but re-fetching is needed (less than 10)");
                    console.log("--------------------------------");
                    delete otherUsersMovieRatings[userId];
                    fetchUserAllRatings(userId);
                }
                else{
                    console.log("-> Most similar user's top rated movies have been cached (no need to be fetched again)");
                    console.log("--------------------------------");
                    updateRecommendedMovies(movieIdsToFetch);
                }
            } else {
                console.log("-> Fetching most similar user's all movie ratings");
                console.log("--------------------------------");
                fetchUserAllRatings(userId);
            }
        }


        fetchUserAllRatings = (userId) => {
            fetch(MOVIES_API_URL + "ratings/" + userId, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).then(response => {
                if (response.status !== 200) {
                    console.log('Looks like there was a problem. Status Code: ' + response.status);
                    return;
                }
                return response.json(); // get the payload
            }).then(data => {
                if (!data || data.length === 0) {
                    return;
                }

                const topHighestRatedMoviesIds = getTopHighestRatedMoviesFromUser(data); // top 50
                otherUsersMovieRatings[userId] = topHighestRatedMoviesIds; // cache this user's top highest rated movies ids
                updateRecommendedMovies(topHighestRatedMoviesIds.slice(0, 10));

            }).catch(err => console.log('Fetch Error :-S', err)); // deal with error 
        }


        const updateRecommendedMovies = (recommendedMoviesIds) => {
            deleteLoadingSpinner();
            document.getElementById("recommended-movies-note").innerHTML = `You have to rate at least ${3-newRatedMoviesN} new movies in order to update recommendations`;
            const recommendedMoviesTable = document.getElementById("recommended-movies-results");
            recommendedMoviesTable.innerHTML = renderMoviesTableHeader();

            let cachedCounter = 0;
            let fetchedCounter = 0;
            recommendedMoviesIds.forEach(movieId => {
                if (movieId in fetchedMoviesById) {
                    cachedCounter++;
                    createMovieTr(fetchedMoviesById[movieId], recommendedMoviesTable);
                }
                else {
                    fetchedCounter++;
                    fetchMovieById(movieId, recommendedMoviesTable);
                }
            })

            recommendedMoviesById = new Set(recommendedMoviesIds);
            console.log("-> updateRecommendedMovies function:" )
            console.log("-> Number of cached movies (no need to be fetched again): ", cachedCounter)
            console.log("-> Number of movies to be fetched: ", fetchedCounter)
            console.log("--------------------------------");
        }


        const createMovieTr = (movie, moviesTableNode) => {
            const movieTr = document.createElement("tr");
            movieTr.innerHTML = renderMovieTr(movie["movieId"], movie["title"], movie["genres"], true);
            moviesTableNode.appendChild(movieTr);

            document.getElementById(`recommended-rating-movieId-${movie["movieId"]}`).addEventListener('change', (e) => {
                movieId = movie["movieId"];
                rating = Number(e.target.value);
                const dropDownRating = document.getElementById(`rating-movieId-${movieId}`);
                if (dropDownRating) {
                    dropDownRating.value = rating;
                }
                onChangeRatingHandler(movieId, rating);
            });
        }


        getTopHighestRatedMoviesFromUser = (userAllRatings) => {
            let top50HighestRatedMovies = [];
            let groupedMoviesByRatings = {  // group movie ids by their ratings
                "5": [],
                "4": [],
                "3": [],
                "2": [],
                "1": []
            };

            const arrayLength = userAllRatings.length;
            for (let i = 0; i < arrayLength; i++) {
                const movieRatingInfo = userAllRatings[i];
                const movieRating = Math.ceil(movieRatingInfo["rating"]).toString();
                const movieId = movieRatingInfo["movieId"];

                if (!(movieId in userMovieRatings)) {
                    // select a movie for recommendation only if it has not been rated (watched) by the user
                    groupedMoviesByRatings[movieRating].push(movieId);
                }

                if (groupedMoviesByRatings["5"].length >= 50) {
                    // if at least 50 movies with rating of 5 are found, there is no need to continue searching for more high rated movies
                    break;
                }
            }

            // extracting the user's highest rated movie ids 
            // (starting with those with rating of 5, continuing with those with rating of 4 and so on)
            for (let i=5; i >= 1; i--) {
                moviesGroup = groupedMoviesByRatings[i.toString()];
                for (let j = 0; j < moviesGroup.length; j++) {
                    top50HighestRatedMovies.push(moviesGroup[j]);
                    if (top50HighestRatedMovies.length === 50) {
                        // only keeping the top 50 highest rated movies (more than enough)
                        return top50HighestRatedMovies;
                    }
                }
            }

            return top50HighestRatedMovies;
        }


        const createPaginationButtons = () => {
            const numOfMoviesResultsIds = moviesResultsIds.length;
            if (numOfMoviesResultsIds <= 10) {
                return ;
            }

            let numOfPages = Math.floor(numOfMoviesResultsIds / 10); // each page will contain 10 movies
            let lastPageNumOfMovies = numOfMoviesResultsIds % 10; 
            if (lastPageNumOfMovies !== 0) { // another page will be needed 
                numOfPages++ ;
            }
            else {
                lastPageNumOfMovies = 10;
            }

            const paginationButtons = `
                <button id="first-page-btn"><<</button>
                <button id="prev-page-btn" style="margin-left: 0.2vw"><</button>
                <div id="current-page-number">1 / ${numOfPages}</div>
                <button id="next-page-btn" style="margin-right: 0.2vw">></button>
                <button id="last-page-btn">>></button>
            `;
            document.getElementById("pagination").innerHTML = paginationButtons;

            document.getElementById("first-page-btn").addEventListener('click', (e) => {
                if (currentPage === 1) {
                    // already in first page
                    return;
                }

                currentPage = 1;
                renderMoviesTable(moviesResultsIds.slice(0, 10)); // get the first 10 movie ids
                document.getElementById("current-page-number").innerHTML = `1 / ${numOfPages}`;
            });

            document.getElementById("last-page-btn").addEventListener('click', (e) => {
                if (currentPage === numOfPages) {
                    // already in last page
                    return;
                }

                currentPage = numOfPages;
                renderMoviesTable(moviesResultsIds.slice(-lastPageNumOfMovies)); // get the last movie ids
                document.getElementById("current-page-number").innerHTML = `${numOfPages} / ${numOfPages}`;
            });

            document.getElementById("next-page-btn").addEventListener('click', (e) => {
                if (currentPage === numOfPages) {
                    // current page is the last one there is no next page
                    return;
                }

                currentPage++;
                if (currentPage === numOfPages) {
                    renderMoviesTable(moviesResultsIds.slice(-lastPageNumOfMovies)); // get the last movie ids
                }
                else {
                    renderMoviesTable(moviesResultsIds.slice((currentPage - 1) * 10, currentPage * 10));
                }
                document.getElementById("current-page-number").innerHTML = `${currentPage} / ${numOfPages}`;
            });

            document.getElementById("prev-page-btn").addEventListener('click', (e) => {
                if (currentPage === 1) {
                    // current page is the first one there is no previous page
                    return;
                }

                currentPage--;
                renderMoviesTable(moviesResultsIds.slice((currentPage - 1) * 10, currentPage * 10));
                document.getElementById("current-page-number").innerHTML = `${currentPage} / ${numOfPages}`;
            });
        }


        const createLoadingSpinner = () => {
            document.getElementById('loading-spinner').innerHTML = `<div id="spinner" class="lds-ring"><div></div><div></div><div></div><div></div></div>`;
        }


        const deleteLoadingSpinner = () => {
            document.getElementById('loading-spinner').innerHTML = "";
        }


    },
    false
);