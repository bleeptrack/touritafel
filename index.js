const wdk = require('wikidata-sdk');
var rp = require('request-promise');
var download = require('download-file');
var paper = require('paper-jsdom-canvas');
var Masto = require('mastodon');
var M = new Masto({
  access_token: '',
  timeout_ms: 60*1000,  
  api_url: '', 
})
var path = require('path');
var fs = require('fs');
var NounProject = require('the-noun-project'),
nounProject = new NounProject({
    key: '',
    secret: ''
});

var options = {
    directory: "",
    filename: "icon.svg"
}

var match = false;

const rdTown = Math.round(Math.random()*9999);


const categories = [
    "Q2095",
    "Q39546"
];

const sparqlTown = `
SELECT DISTINCT ?name
WHERE
{
  ?q p:P31 ?statement .
  ?statement ps:P31/wdt:P279* wd:Q262166 .
  MINUS { ?statement pq:P582|pq:P576 ?x } .  # Without already gone entries (end date or dissolved)
  ?q rdfs:label ?name filter (lang(?name) = "de") .
  ?q wdt:P131* ?qstate .
  ?qstate wdt:P31 wd:Q1221156 .
}
OFFSET ${rdTown} LIMIT 1`; //${rdTown}
const urlTown = wdk.sparqlQuery(sparqlTown);



generate();

var cat = choose(categories);

function objQuery(){
    const rdObject = Math.round(Math.random()*2999);
    
    const sparqlObject = `
    SELECT ?item ?label_en ?label_de ?img ?itemDescription
    WHERE {
    ?item wdt:P279* wd:${cat}.
    
    ?item rdfs:label ?label_en.
    ?item rdfs:label ?label_de.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de" }.
    FILTER((LANG(?label_en)) = "en")
    FILTER((LANG(?label_de)) = "de")
    }
    OFFSET ${rdObject} LIMIT 1`;
    return wdk.sparqlQuery(sparqlObject);
}

function generatePost(obj, town){
    console.debug("generating: "+obj.label_de);
    
    var textArr = [
        `${town}er ${obj.label_de} Museum`,
        `${town}er ${obj.label_de} Sammlung`,
        `${town}er Riesen-${obj.label_de}`,
        `${obj.label_de} ${town}`,
        `${obj.label_de}stadt ${town}`,
        `${obj.label_de}dorf ${town}`
    ];
    
    with (paper) {
        paper.setup(new Size(570, 384));
        
        paper.project.importSVG('icon.svg', {
            onLoad: function(item) {
                console.debug(item.bounds);
                item.fillColor = '#633a34';
                item.strokeColor = 'white';
                
                item.position = new Point(200,200);
                
                
                var rectangle = new Rectangle(new Point(20, 20), new Size(530, 344));
                var rectangleOuter = new Rectangle(new Point(15, 15), new Size(540, 354));
                var rectangleInner = new Rectangle(new Point(45, 45), new Size(480, 294));

                var aussen = new Path.Rectangle(rectangleOuter, 10);
                aussen.strokeColor = '#633a34';
                aussen.strokeWidth = 2;
                aussen.fillColor = 'white';

                var schild = new Path.Rectangle(rectangle, 8);
                schild.fillColor = '#633a34';

                var schild = new Path.Rectangle(rectangleInner, 8);
                schild.fillColor = 'white';

                var maxW = rectangleInner.width*2/3;
                var maxH = rectangleInner.height*2/3;
                var scaleF;
                console.debug(item.bounds.width);
                if(item.bounds.width>item.bounds.height){
                    scaleF = maxW/item.bounds.width;
                }else{
                    scaleF = maxH/item.bounds.height;
                }
                console.debug(scaleF);
                var height = rnd(rectangleInner.height/3,rectangleInner.height*2/3)+rectangleInner.y;
                var floor = new Path();
                floor.add(new Point(rectangleInner.x-5,height));
                var p = new Point(rnd(rectangleInner.x-5,rectangleInner.x+rectangleInner.width+5),height+rnd(10,135)-75);
                var hdl = rnd(10,100);
                floor.add(new Segment(p, new Point(-hdl,0), new Point(hdl,0)));
                floor.add(new Point(rectangleInner.x+rectangleInner.width+5,height));
                floor.add(new Point(rectangleInner.x+rectangleInner.width+5,rectangleInner.y+rectangleInner.height));
                floor.add(new Point(rectangleInner.x-5,rectangleInner.y+rectangleInner.height));
                floor.fillColor = '#633a34';
                
                item.scale(scaleF);
                item.position.x = rnd(item.bounds.width/2,rectangleInner.width-item.bounds.width/2) + rectangleInner.x;
                item.position.y = rectangleInner.y+30+item.bounds.height/2;
                item.bringToFront();
                item.strokeWidth = 5;
                
                var text = new PointText(new Point(rectangleInner.x+rectangleInner.width/2,rectangleInner.y+rectangleInner.height-10));
                text.justification = 'center';
                text.fillColor = 'white';
                text.content = choose(textArr);
                text.scale(rectangleInner.width/text.bounds.width);
                console.log(text.content);

                paper.view.exportFrames({
                    amount: 1,
                    directory: __dirname,
                    onComplete: function() {
                        console.log('Done exporting.');
                        
                        var msg = `${obj.label_de}: ${obj.item.description}`;
                        
                        M.post('media', { file: fs.createReadStream('frame-0.png') }).then(resp => {
                            id = resp.data.id;
                            M.post('statuses', { status: msg, media_ids: [id] })
                        })
                    },
                    onProgress: function(event) {
                        console.log(event.percentage + '% complete, frame took: ' + event.delta);
                    }
                });
            },
            onError: function(message) {
                console.error(message);
            }
        });

        /*var svg = project.exportSVG({ asString: true });
        console.log(svg);

        fs.writeFile(path.resolve('out.svg'),svg, function (err) {
            if (err) throw err;
            console.log('Saved!');
        });*/
    }
}


async function generate(){
    var town = await rp(urlTown)
    .then(wdk.simplify.sparqlResults)
    .then(simplifiedResults => simplifiedResults[0]);
    
    console.debug(town);
    
    getIcon(town);

}

async function getIcon(town){
    var obj = await rp(objQuery())
        .then(wdk.simplify.sparqlResults)
        .then(simplifiedResults => simplifiedResults[0] )
        
    console.debug(obj);
        
    var words = obj.label_en.split(" ");
        
    nounProject.getIconsByTerm(words[words.length-1], {limit: 20, limit_to_public_domain: 1}, function (err, data) {
            if (!err) {
                
                var icon = choose(data.icons);
                var url = icon.icon_url;
                console.debug(url);
                
                download(url, options, function(err){
                    if (err) throw err
                    console.log("svg downloaded");
                    generatePost(obj, town);
                }) 
            }else{
                getIcon(town);
            }
        });
}

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choose(arr){
    var i = rnd(0,arr.length-1);
    return arr[i];
}
