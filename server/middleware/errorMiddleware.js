// Unsupported (404) routes
const notFound = (req, res, next) => {
    const error = new Error(`Page Not Found - ${req.originalUrl}`)
    error.code = 404; // ensure the global error handler returns a 404 instead of defaulting to 500
    res.status(404);
    next(error);
} 

// Middleware to handle errors
const errorHandler = (error, req, res, next) => {
    if(res.headerSent) {
        return next(error)
    }

    res.status(error.code || 500).json({message: error.message || "An unknown error occured"})
}

export {notFound, errorHandler}