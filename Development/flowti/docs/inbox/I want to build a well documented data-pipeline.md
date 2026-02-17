Using Flowti I want to build the pipeline like this:

- ...Inputs (sources)
- ...Processes (Step by Step Guides as links)
- ...Outputs(Exports)

The idea is, to have a list of inputs, then a list of processes, then a list horizontal list of outputs.

Between Every Step we can have a look at the current state of the data by using a base and corresponding view. 

I want to leverage bases here, I build a multi-step import, the next steps would be data-quality processes for example, then I would configure an process step with Doc attached, which creates a .base and a.md file. In the pipeline builder I then could see how many tokens there are in the pipeline, have a .base view for every step, can have a doc note for every step. I want to be able to seamlessly merge csv reports, import them as notes, look at them in a .base view, update data there, then export the data from a prepared .base view to the desired target. I would like to also be able to make those view steps part of the pipeline. Once the data is imported as notes, we can then do whatever we want. Have a .base file with an index view showing all available properties for this type, have a view with only formulars, ready for export, or a view with the minimum required fields to massage before going into the next step. 

I want to connect all of that in a single, straightforward pipeline which supports me in automating data-quality work and connecting the dots together.
