/// import * as Autodesk from "@types/forge-viewer";

import './extensions/LoggerExtension.js';
import './extensions/SummaryExtension.js';
import './extensions/DataGridExtension.js';
import './extensions/HistogramExtension.js';

async function getAccessToken(callback) {
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ getAccessToken }, function () {
            const config = {
                extensions: [
                    'Autodesk.DocumentBrowser',
                    'LoggerExtension',
                    'SummaryExtension',
                    'DataGridExtension',
                    'HistogramExtension',
                    'PotreeExtension'
                ]
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.setTheme('light-theme');
            resolve(viewer);
        });
    });
}

export function loadModel(viewer, urn) {
    return new Promise(function (resolve, reject) {
        function onDocumentLoadSuccess(doc) {
            var viewables = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewables).then(i => {

                // documented loaded, any action?
                var ViewerInstance = new CustomEvent("viewerinstance", 
                    {detail: {
                        viewer: viewer
                    }
                });
                document.dispatchEvent(ViewerInstance);

                var LoadExtensionEvent = new CustomEvent("loadextension", {
                  detail: {
                    extension: "GoogleMapsLocator",
                    viewer: viewer
                  }
                });      
                document.dispatchEvent(LoadExtensionEvent);

                var LoadExtensionEvent = new CustomEvent("loadextension", {
                  detail: {
                    extension: "XLSExtension",
                    viewer: viewer
                  }
                });      
                document.dispatchEvent(LoadExtensionEvent);

                var LoadExtensionEvent = new CustomEvent("loadextension", {
                  detail: {
                    extension: "PhasingExtension",
                    viewer: viewer
                  }
                });      
                document.dispatchEvent(LoadExtensionEvent);

                viewer.loadExtension("CameraRotation");
                
                // after model loaded:
                viewer.loadExtension('PotreeExtension').then(async (ext) => {
                try {
                    let position = new THREE.Vector3(0,0,-25);
                    let scale = new THREE.Vector3(3,5,5);
                    const pointcloud = await ext.loadPointCloud('my-pointcloud', 'https://aps-extensions-sample-data.s3.us-west-2.amazonaws.com/PotreeExtension/lion_takanawa/cloud.js', position, scale);
                    const bbox = pointcloud.boundingBox.clone().expandByVector(scale);
                    viewer.navigation.fitBounds(false, bbox);
                } catch (err) {
                    console.error('Potree load error', err);
                }
                }).catch(err => console.error('Failed to load PotreeExtension', err));


                viewer.loadExtension('IconMarkupExtension', {
                    button: {
                        icon: 'fa-thermometer-half',
                        tooltip: 'Show Temperature'
                    },
                    icons: [
                        { dbId: 3944,   label: '300&#176;C', css: 'fas fa-thermometer-full' },
                        { dbId: 721,    label: '356&#176;C', css: 'fas fa-thermometer-full' },
                        { dbId: 10312,  label: '450&#176;C', css: 'fas fa-thermometer-empty' },
                        { dbId: 563,                         css: 'fas fa-exclamation-triangle' },
                    ],
                    onClick: (id) => {
                        viewers.select(id);
                        viewers.utilities.fitToView();
                        switch (id){
                            case 563:
                                alert('Sensor offline');
                        }
                    }
                })
            });
        }

        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }
        viewer.setLightPreset(0);
        Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}