var app = require('express')();
var randomstring = require("randomstring");
var weather = require('openweather-apis');
var fs = require('fs');
var urllib = require('urllib');
const exec = require('child_process').exec;

var appidkey = (process.env.OPENWEATHER_APIKEY || '08418fc2f148059776aed472e2e417b2');

var defaultCity = 'Sigtuna';

var frontendUrl = (process.env.FRONTEND_SERVICE_IP || 'frontend-test-tore.apps.ocp.rocks');
//var ocToken = process.env.OC_TOKEN;
var ocToken;
var ocpApi = process.env.KUBERNETES_SERVICE_HOST;
var ocpApiPort = process.env.KUBERNETES_SERVICE_PORT_HTTPS;
var dcScaleUrl = (process.env.DC_TO_SCALE || 'https://' + ocpApi + ':' + ocpApiPort + '/oapi/v1/namespaces/test-tore/deploymentconfigs/frontend/scale');

fs.readFile('/run/secrets/kubernetes.io/serviceaccount/token', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  ocToken = data;
});

app.set('port', (process.env.PORT || 8080));

weather.setAPPID(appidkey);
weather.setLang('en');
weather.setCity(defaultCity);

app.get('/city/:nodekey', function(req, res) {
  var nodekey = req.params.nodekey;

  var jsonScale = {"kind":"Scale","apiVersion":"extensions/v1beta1","metadata":{"name":"frontend","namespace":"test-tore","selfLink":"/oapi/v1/namespaces/test-tore/deploymentconfigs/frontend/scale","uid":"65fcf782-9a8d-11e6-87f8-02af4b58a009","resourceVersion":"106298","creationTimestamp":"2016-10-25T08:31:17Z"},"spec":{ "replicas": "2" } }

  weather.setCity(nodekey);

  weather.getDescription(function(err, desc){
    console.log(desc);
    res.send(desc);
    var matches = desc.match(/rain/);
    console.log(matches);
    if (matches !== null) {
      urllib.request('http://' + frontendUrl + '/change.php?weather=w', function (err, data, res) {
        console.log(data.toString());
      });
      jsonScale.spec.replicas = "4";
    } else {
      urllib.request('http://' + frontendUrl + '/change.php?weather=s', function (err, data, res) {
        console.log(data.toString());
      });
      jsonScale.spec.replicas = "2";
    }
    console.log(JSON.stringify(jsonScale));
    fs.writeFile("/tmp/json", JSON.stringify(jsonScale));
    exec('curl -k -X PUT -H "Authorization: Bearer ' + ocToken +'" -H "Content-Type: application/json" -d @/tmp/json ' + dcScaleUrl, (error, stdout, stderr) => {
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    });
  });
});

app.get('/', function(req, res) {
  weather.getDescription(function(err, desc){
    console.log(defaultCity);
    console.log(desc);
    res.send(desc);
  });
});

app.listen(app.get('port'), function(){
  console.log('Server listening on port: ', app.get('port'));
});
