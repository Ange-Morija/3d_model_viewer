const express = require('express');
const formidable = require('express-formidable');
const { listBuckets, listObjects, uploadObject, translateObject, getManifest, urnify, getMetadata,
  getViewProperties } = require('../services/aps.js');

let router = express.Router();

router.get('/api/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        res.json(objects.map(o => ({
            name: o.objectKey,
            urn: urnify(o.objectId)
        })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});


router.get('/api/models/buckets', async function (req, res, next) {
    try {
        const bucket_name = req.query.id;
        if (!bucket_name || bucket_name === '#') {
            const buckets = await listBuckets();
            res.json(buckets.map((bucket) => {
                return {
                    id: bucket.bucketKey,
                    text: bucket.bucketKey,
                    type: 'bucket',
                    children: true
                };
            }));
            
        } else {
            const objects = await listObjects(bucket_name);
            res.json(objects.map((object) => {
                return {
                    id: Buffer.from(object.objectId).toString('base64'),
                    text: object.objectKey,
                    type: 'object',
                    children: false
                };
            }));
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models/upload', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files.fileToUpload;
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const obj = await uploadObject(file.name, file.path, req.fields.bucketKey);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});

router.get('/api/models/:urn/metadata', async (req, res, next) => {
  try {
    const meta = await getMetadata(req.params.urn);
    const views = meta?.data?.metadata?.map(v => ({ guid: v.guid, name: v.name, role: v.role })) || [];
    res.json(views);
  } catch (err) { next(err); }
});


router.get('/api/models/:urn/metadata/:guid/properties', async function (req, res, next) {
  try {
    const props = await getViewProperties(req.params.urn, req.params.guid);
    res.json(props);
  } catch (err) {
    next(err);
  }
});


module.exports = router;