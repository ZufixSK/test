<?php
// save.php — Append a CSV row after STOP
// Writes to data/productivity_log.csv (create if not exists)

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
if ($raw === false) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'No input']);
  exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Invalid JSON']);
  exit;
}

// Basic sanitation
function s($k){
  return isset($GLOBALS['data'][$k]) ? trim(strval($GLOBALS['data'][$k])) : '';
}
$pallet = s('palletCode');
$name = s('name');
$start = s('start');
$end = s('end');
$netSeconds = isset($data['netSeconds']) ? intval($data['netSeconds']) : 0;
$pauseCount = isset($data['pauseCount']) ? intval($data['pauseCount']) : 0;
$pauseReasons = s('pauseReasons');
$leftover = isset($data['leftover']) ? intval($data['leftover']) : 0;

if ($pallet === '' || $name === '' || $start === '' || $end === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Missing required fields']);
  exit;
}

// CSV target
$dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dir)) { mkdir($dir, 0775, true); }
$file = $dir . DIRECTORY_SEPARATOR . 'productivity_log.csv';
$exists = file_exists($file);

// Open with locking
$fp = fopen($file, 'a');
if (!$fp) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Cannot open file']);
  exit;
}
if (flock($fp, LOCK_EX)) {
  if (!$exists) {
    // Header
    fputcsv($fp, ['Kód palety','Meno','Začiatok','Koniec','čistý čas vykladania (s)','počet pauz','dôvody pauzy','zostalo kartónov']);
  }
  $row = [
    $pallet,
    $name,
    $start,
    $end,
    $netSeconds,
    $pauseCount,
    $pauseReasons,
    $leftover
  ];
  fputcsv($fp, $row);
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
} else {
  fclose($fp);
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Cannot lock file']);
  exit;
}

// Response
echo json_encode(['ok'=>true, 'id'=>substr(sha1($pallet.$start.$end.microtime(true)),0,10)]);
