const session = require("express-session");
app.use(
  session({
    secret: "kahdsodjsdmdihdsddaddsa",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
