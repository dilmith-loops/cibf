<?php

use Illuminate\Support\Facades\Route;

/**
 * Catch-all web route:
 * Serves the pre-compiled React Single Page Application (SPA).
 * All /api/* routes are handled by routes/api.php.
 */
Route::get('/{any?}', function () {
    $indexPath = public_path('index.html');
    if (file_exists($indexPath)) {
        return response()->file($indexPath);
    }

    return response()->json([
        'status' => 'React frontend not built yet.',
        'message' => 'Please run "npm run build" locally to compile the React frontend into public/index.html before deploying.'
    ], 404);
})->where('any', '^(?!(api|cibf/api|booktrack/api)).*$');
