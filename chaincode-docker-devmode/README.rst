Using dev mode
==============

Normally chaincodes are started and maintained by peer. However in “dev
mode", chaincode is built and started by the user. This mode is useful
during chaincode development phase for rapid code/build/run/debug cycle
turnaround.

We start "dev mode" by leveraging pre-generated orderer and channel artifacts for
a sample dev network.  As such, the user can immediately jump into the process
of compiling chaincode and driving calls.


.. code:: bash

  cd chaincode-docker-devmode

Download docker images
^^^^^^^^^^^^^^^^^^^^^^

We need four docker images in order for "dev mode" to run against the supplied
docker compose script.  If you installed the ``fabric-samples`` repo clone and
followed the instructions to :ref:`download-platform-specific-binaries`, then
you should have the necessary Docker images installed locally.

.. note:: If you choose to manually pull the images then you must retag them as
          ``latest``.

Issue a ``docker images`` command to reveal your local Docker Registry.  You
should see something similar to following:

.. code:: bash

  docker images
  REPOSITORY                     TAG                                  IMAGE ID            CREATED             SIZE
  hyperledger/fabric-tools       latest                               e09f38f8928d        4 hours ago         1.32 GB
  hyperledger/fabric-tools       x86_64-1.0.0-rc1-snapshot-f20846c6   e09f38f8928d        4 hours ago         1.32 GB
  hyperledger/fabric-orderer     latest                               0df93ba35a25        4 hours ago         179 MB
  hyperledger/fabric-orderer     x86_64-1.0.0-rc1-snapshot-f20846c6   0df93ba35a25        4 hours ago         179 MB
  hyperledger/fabric-peer        latest                               533aec3f5a01        4 hours ago         182 MB
  hyperledger/fabric-peer        x86_64-1.0.0-rc1-snapshot-f20846c6   533aec3f5a01        4 hours ago         182 MB
  hyperledger/fabric-ccenv       latest                               4b70698a71d3        4 hours ago         1.29 GB
  hyperledger/fabric-ccenv       x86_64-1.0.0-rc1-snapshot-f20846c6   4b70698a71d3        4 hours ago         1.29 GB

.. note:: If you retrieved the images through the :ref:`download-platform-specific-binaries`,
          then you will see additional images listed.  However, we are only concerned with
          these four.

Now open three terminals and navigate to your ``chaincode-docker-devmode``
directory in each.

Terminal 1 - Start the network
------------------------------
.. note:: remove all hyperledger docker containers to avoid port conflicts :

.. code:: bash

    docker rm -f $(docker ps -aq)

.. code:: bash

    docker-compose -f docker-compose-simple.yaml up

The above starts the network with the ``SingleSampleMSPSolo`` orderer profile and
launches the peer in "dev mode".  It also launches two additional containers -
one for the chaincode environment and a CLI to interact with the chaincode.  The
commands for create and join channel are embedded in the CLI container, so we
can jump immediately to the chaincode calls.

Terminal 2 - Build & start the chaincode
----------------------------------------

.. code:: bash

  docker exec -it chaincode bash

You should see the following:

.. code:: bash

  root@d2629980e76b:/opt/gopath/src/chaincode#

Now, compile your chaincode:

.. code:: bash

  cd helloWorld
  go build

Now run the chaincode:

.. code:: bash

  CORE_PEER_ADDRESS=peer:7051 CORE_CHAINCODE_ID_NAME=mycc:0 ./helloWorld

The chaincode is started with peer and chaincode logs indicating successful registration with the peer.
Note that at this stage the chaincode is not associated with any channel. This is done in subsequent steps
using the ``instantiate`` command.

Terminal 3 - Use the chaincode
------------------------------

Even though you are in ``--peer-chaincodedev`` mode, you still have to install the
chaincode so the life-cycle system chaincode can go through its checks normally.
This requirement may be removed in future when in ``--peer-chaincodedev`` mode.

We'll leverage the CLI container to drive these calls.

.. code:: bash

  docker exec -it cli bash

.. code:: bash

  peer chaincode install -p chaincodedev/chaincode/helloWorld -n mycc -v 0
  peer chaincode instantiate -n mycc -v 0 -c '{"Args":["init"]}' -C myc

Now issue an invoke to move initialize the KV store.

.. code:: bash

  peer chaincode invoke -n mycc -c '{"Args":["writeFunc1","key","hello world"]}' -C myc

Finally, query ``key``.  We should see a value of ``hello world``.

.. code:: bash

  peer chaincode query -n mycc -c '{"Args":["readFunc1","key"]}' -C myc
