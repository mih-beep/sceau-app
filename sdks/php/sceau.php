<?php
class SceauClient {
    private $apiUrl = "https://sceau-app.vercel.app/api/v1/public/seal";

    public function sealFile($filePath) {
        $cFile = new CURLFile($filePath);
        $data = array('file' => $cFile);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->apiUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
}
?>
