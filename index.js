
var s3 = new (require('aws-sdk')).S3(),
	async = require('async'),
	gm = require('gm').subClass({ imageMagick: true });

var config = {
	distBucket: 'your-bucket-name',
	resizes: [{
		size: 40,
		directory: 'tiny'
	}, {
		size: 240,
		directory: 'medium'
	}, {
		size: 550,
		directory: 'normal'
	}, {
		size: 850,
		directory: 'large'
	}, {
		size: 1280,
		directory: 'giant'
	}]
};
 
exports.handler = function(event, context) {
    
    console.log('Starting...');

	var sourceBucket      = event.Records[0].s3.bucket.name,
		filepath          = event.Records[0].s3.object.key,
		filename          = filepath.split(/(\\|\/)/g).pop(),
		validExtensions   = ['jpg', 'jpeg', 'png'];
		
	console.log('Filename: ', filename);

	if (! filename) { return; }

	var fileExtension = filename.match(/\.([^.]*)$/)[1];

	// Buckets must be different
	if (sourceBucket === config.distBucket) {
		console.error('Destination bucket must not match source bucket');
		return;
	}

	// Must be an image of a valid extension
	if (validExtensions.indexOf(fileExtension) === -1) {
		console.log('Skipping non valid image: ' + filename);
		return;
	}

	function transform(gmInstance, contentType, size, max_size, directory) {
	    
		// Get the scaling factor
		var scaling = Math.min(max_size / size.width, max_size / size.height),
			width  = scaling * size.width;
			height = scaling * size.height;

		// Transform the image buffer in memory.
		gmInstance.resize(width, height).toBuffer(fileExtension, function(err, buffer) {

			console.log(directory + ' image resized!');

			if (err) {
				console.error(err);
				return;
			}

			s3.putObject({
				Bucket: config.distBucket,
				Key: directory + '/' + filename,
				Body: buffer,
				ContentType: contentType
			}, function() {});
		});
	}

	function download(next) {
	    console.log('Downloading ' + sourceBucket + filepath + '...');
	    
		s3.getObject({
			Bucket: sourceBucket,
			Key: filepath
		}, next);
	}

	function processImages(response, next) {
	    console.log('Processing image...');

		var contentType = response.ContentType;

		gm(response.Body).size(function(err, size) {

			for (var i = 0; i < config.resizes.length; i++) {
				ths_resize = config.resizes[i];
				transform(this, contentType, size, ths_resize.size, ths_resize.directory);
			}
		});
	}

	async.waterfall([download, processImages]);
};
