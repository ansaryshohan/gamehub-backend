const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const cors = require("cors");
require("dotenv").config();
const { dbConnect, client } = require("./dbConnect");
const { ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

// DB connection
dbConnect();

async function run() {
  try {
    const gamesCollection = await client.db("gameHub").collection("allGames");
    const commentsCollection = await client
      .db("gameHub")
      .collection("comments");
    const wishlistCollection = await client
      .db("gameHub")
      .collection("wishList");

    // get all game review data
    app.get("/reviews", async (req, res) => {
      const allGames = await gamesCollection.find({}).toArray();
      return res.json(allGames);
    });
    // get a single game review data details
    app.get("/review/:id", async (req, res) => {
      const { id } = req.params;
      // console.log(id)
      try {
        const gameData = await gamesCollection
          .aggregate([
            { $match: { _id: new ObjectId(id) } },
            {
              $lookup: {
                from: "comments",
                localField: "comments",
                foreignField: "_id",
                as: "comments",
              },
            },
          ])
          .toArray();
        // console.log(gameData);
        return res.status(200).json(gameData);
      } catch (error) {
        return res.status(400).json("internal server error");
      }
    });
    // add new games review
    app.post("/add-review", async (req, res) => {
      const gameData = req.body;
      // console.log(gameData)
      try {
        const insertReview = await gamesCollection.insertOne(req.body);
        // console.log(insertReview);
        return res.status(201).json(insertReview);
      } catch (error) {
        return res.status(401).json("review adding unsuccessful");
      }
    });
    // update a game review
    app.patch("/review/:id", async (req, res) => {
      const { id: reviewId } = req.params;
      const updatedReviewData = req.body;
      try {
        const updateReview = await gamesCollection.updateOne(
          { _id: new ObjectId(reviewId) },
          { $set: updatedReviewData }
        );
        if (updateReview.modifiedCount > 0) {
          const myAllReviews = await gamesCollection
            .find({ userEmail: updatedReviewData.userEmail })
            .toArray();
          // console.log(myAllReviews);
          return res
            .status(201)
            .json({ success: true, data: updateReview, myAllReviews });
        }
        return res.status(201).json({
          success: false,
          data: updateReview,
          message: "NO Review updated",
        });
      } catch (error) {
        return res.status(400).json("internal server error");
      }
    });
    // delete a review
    app.delete("/review/:id", async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.body;
      try {
        const deletedData = await gamesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        const gameReviewDataAfterDelete = await gamesCollection
          .find({ userEmail })
          .toArray();
        // console.log(deletedData,gameReviewDataAfterDelete);
        return res
          .status(200)
          .json({ success: true, deletedData, gameReviewDataAfterDelete });
      } catch (error) {
        res.status(400).json("internal server error");
      }
    });

    // top games data
    app.get("/top-games", async (req, res) => {
      const topGames = await gamesCollection
        .find({})
        .sort({ rating: -1 })
        .limit(4)
        .toArray();
      return res.json(topGames);
    });

    // get my reviews
    app.post("/my-reviews", async (req, res) => {
      const { userEmail } = req.body;
      // console.log(userEmail);
      try {
        const myReview = await gamesCollection.find({ userEmail }).toArray();
        // console.log(myReview);
        return res.status(201).json(myReview);
      } catch (error) {
        return res.status(401).json("internal server error");
      }
    });

    // add a comment/update the game comment array
    app.patch("/add-comment", async (req, res) => {
      try {
        const { gameId, commentData } = req.body;
        // console.log(commentData, gameId);
        const findGame = await gamesCollection.findOne({
          _id: new ObjectId(gameId),
        });
        // console.log(findGame);
        if (findGame) {
          const addComment = await commentsCollection.insertOne({
            ...commentData,
            gameId,
          });
          // console.log(addComment);

          const updateResponse = await gamesCollection.updateOne(
            { _id: new ObjectId(gameId) },
            { $addToSet: { comments: addComment.insertedId } }
          );

          const updateData = await gamesCollection
            .aggregate([
              {
                $match: { _id: new ObjectId(gameId) },
              },
              {
                $lookup: {
                  from: "comments",
                  localField: "comments",
                  foreignField: "_id",
                  as: "comments",
                },
              },
            ])
            .toArray();
         // console.log(updateData);
          return res
            .status(200)
            .json({ success: true, data: { updateResponse, updateData } });
        }
      } catch (error) {
        res.json(401).json(error);
      }
    });
    // get data of wishlist for wishlist page
    app.get("/allWishlist/:userEmail", async (req, res) => {
      const { userEmail } = req.params;
      // console.log("Received userEmail:", userEmail);
      try {
        const wishlist = await wishlistCollection
          .aggregate([
            { $match: { userEmail } },
            {
              $addFields: {
                wishlistObjectIds: {
                  $map: {
                    input: "$wishlist",
                    as: "gameId",
                    in: { $toObjectId: "$$gameId" }, // Convert to ObjectId
                  },
                },
              },
            },
            {
              $lookup: {
                from: "allGames",
                localField: "wishlistObjectIds",
                foreignField: "_id",
                as: "games",
              },
            },
            {
              $project: {
                games: 1,
              },
            },
          ])
          .toArray();
        // console.log(wishlist);
        if (wishlist) {
          return res
            .status(200)
            .json({
              success: true,
              message: "wishlist",
              data: wishlist[0]?.games,
            });
        }
        return res
          .status(200)
          .json({ success: false, message: "wishlist", data: null });
      } catch (error) {
        return res.status(401).json({ success: false, error });
      }
    });
    // get data of wishlist
    app.get("/wishlist/:userEmail", async (req, res) => {
      const { userEmail } = req.params;
      // console.log("Received userEmail:", userEmail);
      try {
        const wishlist = await wishlistCollection.findOne({ userEmail });
        // console.log(wishlist);
        if (wishlist) {
          return res
            .status(200)
            .json({ success: true, message: "wishlist", data: wishlist });
        }
        return res
          .status(200)
          .json({ success: false, message: "wishlist", data: null });
      } catch (error) {
        return res.status(401).json({ success: false, error });
      }
    });
    // add to wishlist
    app.post("/wishlist", async (req, res) => {
      const { userEmail, gameId } = req.body;
      try {
        const findUser = await wishlistCollection.findOne({ userEmail });
        if (!findUser) {
          const insertUserData = await wishlistCollection.insertOne({
            userEmail,
            wishlist: [gameId],
          });
          // console.log(insertUserData);
          if (insertUserData.acknowledged) {
            const newWishListData = await wishlistCollection.findOne({
              userEmail,
            });
            // console.log(insertUserData);
            return res.status(201).json({
              success: true,
              message: "insert",
              insertData: insertUserData,
              data: newWishListData,
            });
          }
        }
        const updateWishlist = await wishlistCollection.updateOne(
          { userEmail },
          { $addToSet: { wishlist: gameId } }
        );

        if (updateWishlist.acknowledged) {
          const newWishListData = await wishlistCollection.findOne({
            userEmail,
          });

          return res.status(201).json({
            success: true,
            message: "update",
            insertData: updateWishlist,
            data: newWishListData,
          });
        }
      } catch (error) {
        return res.status(401).json({ success: false, error });
      }
    });
    // delete from wishlist
    app.delete("/wishlist", async (req, res) => {
      const { userEmail, gameId } = req.body;
      try {
        const findUser = await wishlistCollection.findOne({ userEmail });
        if (!findUser) {
          return res.status(301).json({
            success: false,
            message: "user not found",
          });
        }
        const updateWishlist = await wishlistCollection.updateOne(
          { userEmail },
          { $pull: { wishlist: gameId } }
        );

        if (updateWishlist.acknowledged) {
          const newWishListData = await wishlistCollection
            .aggregate([
              { $match: { userEmail } },
              {
                $addFields: {
                  wishlistObjectIds: {
                    $map: {
                      input: "$wishlist",
                      as: "gameId",
                      in: { $toObjectId: "$$gameId" }, // Convert to ObjectId
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: "allGames",
                  localField: "wishlistObjectIds",
                  foreignField: "_id",
                  as: "games",
                },
              },
              {
                $project: {
                  games: 1,
                },
              },
            ])
            .toArray();

          return res.status(201).json({
            success: true,
            message: "delete",
            deleteData: updateWishlist,
            data: newWishListData[0]?.games,
          });
        }
      } catch (error) {
        return res.status(401).json({ success: false, error });
      }
    });
  } catch (error) {
    return res.status(401).json({ success: false, error });
  }
}

run();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
