<?php
require 'vendor/autoload.php';

try {
	$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
	$dotenv->load();
} catch (Exception $e) {
	echo "Caught exception: ", $e->getMessage(), "\n";
}

if (isset($_POST["submit"])) {
	$name = $_POST["name"];
	$from = $_POST["email"];
	$message = $_POST["message"];

	$sgMail = new \SendGrid\Mail\Mail();
	$sgMail->setFrom("malte@omnilabs.digital", "Contact Form");
	$sgMail->setSubject("Omnilabs Contact Form");
	$sgMail->addTo("malte@omnilabs.digital", "Malte");
	$sgMail->addContent("text/plain", "Omnilabs Contact Form Inquiry");
	$sgMail->addContent(
		"text/html",
		"<h1>User:<br></br>$name, Email: $from</h1><br></br><h2>Message:<br></br>$message</h2>"
	);

	if ($_ENV["SENDGRID_API_KEY"]) {
		$apiKey = $_ENV["SENDGRID_API_KEY"];
	}

	if (getenv("SENDGRID_API_KEY")) {
		$apiKey = getenv("SENDGRID_API_KEY");
	}

	$apiKey = getenv("SENDGRID_API_KEY");

	$sendgrid = new \SendGrid($apiKey);

	if ($sendgrid->send($sgMail)) {
		header("Location: index.html");
		// echo "email sent";
	} else {
		echo "Something went wrong. Please try again.";
	}
}
