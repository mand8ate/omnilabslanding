<?php

require 'vendor/autoload.php';

function isInjected($str)
{
	$injections = array('(\n+)', '(\r+)', '(\t+)', '(\%0A+)', '(\%0D+)', '(\%08+)', '(\%09+)');

	$inject = join('|', $injections);
	$inject = "/$inject/i";

	if (preg_match($inject, $str)) {
		return true;
	} else {
		return false;
	}
}

$visitorName = $_POST["name"];
$visitorEmail = $_POST["email"];
$visitorMessage = $_POST["text"];

if (empty($visitorName) || empty($visitorEmail) || empty($visitorMessage)) {
	echo "Name, email and a text are mandatory!";
}

if (isInjected($visitorName)) {
	echo "You form contains some bad input. Please try again!";
	exit;
}

if (isInjected($visitorEmail)) {
	echo "Your form contains some bad input. Please try again!";
	exit;
}

if (isInjected($visitorMessage)) {
	echo "Your form contains some bad input. Please try again!";
	exit;
}

$email = new \SendGrid\Mail\Mail();
$email->setFrom("Email from: $visitorEmail", "User: $visitorName");
$email->setSubject("Inquiry form from Omnilabs.digital website");
$email->addTo("malte@omnilabs.digital");
$email->addContent("text/plain", "Message: $visitorMessage");
$sendgrid = new \SendGrid(getenv("SENDGRID_API_KEY"));

try {
	$response = $sendgrid->send($email);
	print $response->statusCode() . "\n";
	print_r($response->headers());
	print $response->body() . "\n";
} catch(Exception $e) {
	echo "Caught exception: " . $e->getMessage() . "\n";
}

?>