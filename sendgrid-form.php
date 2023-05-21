<?php
require 'vendor/autoload.php';

try {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
} catch (Exception $e) {
    error_log("Unable to load .env file. Error: " . $e->getMessage());
    exit;
}

if (isset($_POST["submit"])) {

    // sanitize POST variables
    $name = htmlspecialchars($_POST["name"], ENT_QUOTES, 'UTF-8');
    $from = filter_var($_POST["email"], FILTER_SANITIZE_EMAIL);
    $message = htmlspecialchars($_POST["message"], ENT_QUOTES, 'UTF-8');

    $sgMail = new \SendGrid\Mail\Mail();
    $sgMail->setFrom("malte@omnilabs.digital", "Contact Form");
    $sgMail->setSubject("Omnilabs Contact Form");
    $sgMail->addTo("malte@omnilabs.digital", "Malte");
    $sgMail->addContent("text/plain", "Omnilabs Contact Form Inquiry");
    $sgMail->addContent(
        "text/html",
        "<h1>User:<br></br>$name, Email: $from</h1><br></br><h2>Message:<br></br>$message</h2>"
    );

    $apiKey = $_ENV["SENDGRID_API_KEY"] ?? null;

    if (!$apiKey) {
        error_log("SENDGRID_API_KEY not found in .env");
        exit;
    }

    try {
        $sendgrid = new \SendGrid($apiKey);
        $response = $sendgrid->send($sgMail);

        if ($response->statusCode() >= 200 && $response->statusCode() < 300) {
            header("Location: index.html");
            exit;
        } else {
            error_log("Email not sent. SendGrid response code: " . $response->statusCode());
        }
    } catch (Exception $e) {
        error_log("SendGrid Exception: " . $e->getMessage());
    }
}
