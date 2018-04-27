Using Couch DB as state database
==============

By default peer uses goleveldb as its default embeded key value state database.
However if we want to perform complex queries on the state content (non-key queries) we can configure the peer to use couchDB as its state database.


.. note:: Make sure that the required docker images are downloaded. If not then follow the steps in: 
https://github.com/nitesh7sid/chaincode-dev-mode/blob/master/chaincode-docker-devmode/README.rst 
          
          
Terminal 1 - Start the couchDB container
------------------------------

.. code:: bash

    docker-compose -f docker-compose-couchDB.yaml up

The above command will start a couchDB container.

Terminal 2 - Start the network with couchDB IP:port details specified in the docker-compose-simple.yaml
----------------------------------------

1. Open docker-compose-simple.yaml and under peer service uncomment the two environment variables
- CORE_LEDGER_STATE_STATEDATABASE=CouchDB
- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchDB_container_IP:port

Make sure correct couchDB container IP and port is specified.

.. code:: bash

  docker-compose -f docker-compose-simple.yaml up
  
  
Terminal 3 - Build & start the marbles02 chaincode
----------------------------------------

.. code:: bash

  docker exec -it chaincode bash

You should see the following:

.. code:: bash

  root@d2629980e76b:/opt/gopath/src/chaincode#

Now, compile your chaincode:

.. code:: bash

  cd marbles02
  go build

Now run the chaincode:

.. code:: bash

  CORE_PEER_ADDRESS=peer:7051 CORE_CHAINCODE_ID_NAME=mycc:0 ./marbles_chaincode

The chaincode is started with peer and chaincode logs indicating successful registration with the peer.
Note that at this stage the chaincode is not associated with any channel. This is done in subsequent steps
using the ``instantiate`` command.

Terminal 4 - Use the chaincode
------------------------------

Even though you are in ``--peer-chaincodedev`` mode, you still have to install the
chaincode so the life-cycle system chaincode can go through its checks normally.
This requirement may be removed in future when in ``--peer-chaincodedev`` mode.

We'll leverage the CLI container to drive these calls.

.. code:: bash

  docker exec -it cli bash

.. code:: bash

  peer chaincode install -p chaincodedev/chaincode/marbles02 -n mycc -v 0
  peer chaincode instantiate -n mycc -v 0 -c '{"Args":["init"]}' -C myc

Now issue an invoke to create a new marble.

.. code:: bash

  peer chaincode invoke -C myc -n mycc -c '{"Args":["initMarble","marble1","blue","35","tom"]}

Finally, query ``marble1``.

.. code:: bash

  peer chaincode query -C myc -n mycc -c '{"Args":["readMarble","marble1"]}'
  
For complete list of available functions refer https://github.com/nitesh7sid/chaincode-dev-mode/blob/master/chaincode/marbles02/marbles_chaincode.go
