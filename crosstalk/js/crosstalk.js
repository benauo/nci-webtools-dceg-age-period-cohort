$(document).ready(function () {
    // Save DOM references to minimize queries
    var cfg = crosstalk.config({
        description: $('#description'),
        startYear: $('#startYear'),
        startAge: $('#startAge'),
        interval: $('#interval'),
        titleA: $('#title1'),
        titleB: $('#title2'),
        inputFileA: $('#inputfile1'),
        inputFileB: $('#inputfile2')
    });

    // Add event listeners
    for (element in cfg)
        cfg[element].change(crosstalk.update);

    $.adamant.pastable.functions["crosstalk-input"] = function (target, data) {
        var data = data.split(/[\r\n]+/);
        while (data[data.length - 1].trim() == "") {
            data.pop();
        }
        data = data.map(function (line) {
            var line = line.split(",");
            line.map(function (entry) {
                return parseFloat(entry);
            });
            return line;
        });
        var datatarget = $(target).attr('data-target');
        self.model[datatarget] = $.extend(self.model[datatarget] || {}, {
            'table': data,
            'title': $('#' + $('#' + datatarget).attr('data-target')).val()
        });
        $(target).children("textarea").val("");
        crosstalk.update();
    };

    $(document).on("shown.bs.tab", function (event, ui) {
        // fix dataTable column widths on tab change
        var tables = $.fn.dataTable.fnTables(true);
        if (tables.length > 0) {
            $.each(tables, function () {
                $(this).dataTable().fnAdjustColumnSizing();
            });
        }
    });

    $(document).on("hidden.bs.modal", function () {
        $("#imgPreview .modal-body").empty();
    });

    $('#dataset1, #dataset2').on('drop', function (e) {
        e.preventDefault();
        crosstalk.drop(e);
    });

    $("#dataFlip").click(function (e) {
        e.preventDefault();
        var swap = self.model.inputfile2;
        self.model.inputfile2 = self.model.inputfile1;
        self.model.inputfile1 = swap;
        swap = cfg.titleB.val();
        cfg.titleB.val(cfg.titleA.val());
        cfg.titleA.val(swap);
        crosstalk.update();
    });

    $('#startYear').spinner({
        min: 1800,
        max: 2200,
        step: 1,
        spin: crosstalk.update,
        stop: crosstalk.update
    });

    $('#startAge').spinner({
        min: 0,
        max: 120,
        step: 1,
        spin: crosstalk.update,
        stop: crosstalk.update
    });

    $('#interval').spinner({
        min: 1,
        max: 10,
        step: 1,
        spin: crosstalk.update,
        stop: crosstalk.update
    });

    $("#showNumber, #showNumber + button").on("click", function () {
        $("#showSwitch").trigger("change");
    });

    $("#showSwitch").on("change", function () {

        if (this.checked) {
            $("#irrGraphs img:first").addClass("show");
            $("#irrGraphs img:nth(1)").removeClass("show");
        } else {
            $("#irrGraphs img:first").removeClass("show");
            $("#irrGraphs img:nth(1)").addClass("show");
        }

    });

    $('#modelBt').click(crosstalk.getData);

    $('[type="reset"]').click(crosstalk.reset);
    crosstalk.reset();
});

/* ---------- ReadFile Module - Parses an input file as a crosstalk model ---------- */
var readfile = (function () {

    return {
        createModel: createModel
    };

    /* ---------- Reads a file from an input element and returns the generated model as a parameter to the callback ---------- */
    function createModel(element, callback) {
        readFile(element, function (contents) {
            callback(element.id, {
                title: parseHeader(contents.shift()),
                description: parseHeader(contents.shift()),
                startYear: parseInt(parseHeader(contents.shift())),
                startAge: parseInt(parseHeader(contents.shift())),
                interval: parseInt(parseHeader(contents.shift())),
                table: parseTable(contents)
            });
        });
    }

    /* ---------- Reads a file from an input element and returns an array of lines to the callback ---------- */
    function readFile(element, callback) {
        if (window.FileReader) {
            var file = element.files[0];
            var reader = new FileReader();

            if (file)
                reader.readAsText(file);

            reader.onload = function (event) {
                callback(event.currentTarget.result.split(/[\r\n]+/g));
            };
        }
    }

    /* ---------- Parse an array of lines (from a csv) as a matrix of floats ---------- */
    function parseTable(table) {
        while (table[table.length - 1].trim() == "") {
            table.pop();
        }
        return table.map(function (line) {
            return line.split(',').map(function (element) {
                return parseFloat(element);
            });
        });
    }

    /* ---------- Parse a header line - return the portion after the first colon ---------- */
    function parseHeader(line) {
        var description = line.match(/"(.*?)"/);

        if (description)
            line = description[1];
        else
            line = line.split(',')[0];

        return line.split(/:(.+)?/, 2)[1].trim();
    }

})();


/* ---------- CrossTalk Module - Syncs the model and calculation results with the UI ---------- */
var crosstalk = (function ($, ReadFile) {
    var self = this;

    // Holds DOM references
    self.cfg = {
        description: null,
        startYear: null,
        startAge: null,
        interval: null,
        titleA: null,
        titleB: null,
        inputFileA: null,
        inputFileB: null,
    };

    // Holds values from the DOM in a model
    self.model = {
        description: null,
        startYear: null,
        startAge: null,
        interval: null,
        titleA: null,
        titleB: null,
        inputfile1: null,
        inputfile2: null
    };


    // set default datatable options
    $.extend(true, $.fn.dataTable.defaults, {
        "destroy": true,
        "bSort": false,
        "bFilter": false,
        "paging": false,
        "responsive": true,
        "dom": 't',
        "scrollX": true
    });

    return {
        drop: drop,
        update: update,
        config: config,
        getData: getData,
        reset: reset,
        model: self.model,
        dtDefaults: self.tableDefaults
    };

    function getData() {
        if (self.model.inputfile1 && self.model.inputfile2 && self.model.inputfile1.table.length == self.model.inputfile2.table.length && self.model.inputfile1.table[0].length == self.model.inputfile2.table[0].length) {
            $.ajax({
                method: "POST",
                url: crosstalk_form.action,
                data: JSON.stringify(crosstalk.model),
                beforeSend: function () {
                    $(".loading").css("display", "block");
                }
            }).done(function (data) {
                $("#rateGraphs, #irrGraphs, .graphsContainers").empty();
                var result = data;
                for (var key in result.data) {
                    var resultSet = result.data[key];

                    if (key == "IncidenceRates")
                        incRatesTab(resultSet);
                    else if (key == "IncidenceRateRatios")
                        incRateRatioTab(resultSet);
                    else if (key == "ApcOfRateRatios")
                        apcRateRatioTab(resultSet);
                }
                $(".output").addClass("show");

                // bind events to newly generated images
                $(".expandImg").on("click", previewImage);
            }).fail(function () {
                console.log("failed");
            }).always(function () {
                $(".loading").css("display", "none");
            });
        } else {
            alert("needs a message 3");
        }
    }

    function createOutputHeaders(initial, headers) {
      var returnHeaders = $.extend(true,[],initial);
      for (var i = 0; i < headers.length; i++) {
        returnHeaders.push({
          data: headers[i].toString(),
          title: headers[i].toString()
        });
      }
      return returnHeaders;
    }

    function createOutputTable(containerId,title,table,headers) {
        var target = $(containerId);
        if ($.fn.DataTable.isDataTable(containerId)) {
            target.DataTable().destroy();
        }
        target.empty().html("").before("<h4 class='title'>" + title + "</h4>");
        var dTbl = target.DataTable({
            "data": table,
            "columns": headers
        });

        $(dTbl.table().header()).prepend(
            "<tr role='row'><th>Rate</th><th colspan='" + (headers.length-1) + "'>Calendar Period</th></tr>");
        target.dataTable().fnDraw();
    }

    function incRatesTab(result) {
        var t2 = $("#rateTable2");

        // result has tables, headers and graphs properties
        var headers = createOutputHeaders([{
            data: "_row",
            title: "Age Group"
        }],result.headers);

        if (result.tables[0]) {
            createOutputTable("#rateTable1",model.titleA,result.tables[0],headers);
            $("#rateGraphs").append("<a class='expandImg'data-toggle='modal' data-target='#imgPreview'><img class='img-responsive col-sm-6' src='" + result.graphs[0] + "' /></a>");
        }

        if (result.tables[1]) {
            createOutputTable("#rateTable2",model.titleB,result.tables[1],headers);
            $("#rateGraphs").append("<a class='expandImg'data-toggle='modal' data-target='#imgPreview'><img class='img-responsive col-sm-6' src='" + result.graphs[1] + "' /></a>");
        }
    }

    function incRateRatioTab(result) {
        var t1 = $("#irrTable");
        // result has tables, headers and graphs properties
        var headers = createOutputHeaders([{
            data: "_row",
            title: "Age Group"
        }],result.headers);

        var t1 = $("#irrTable");
        $("#irrTables .title").html("");
        if (result.tables[0]) {
            createOutputTable("#irrTable",(model.titleA + " vs " + model.titleB),result.tables[0],headers);
            $("#irrGraphs").append(
                "<img class='img-responsive show' src='" + result.graphs[0][0] + "' />" +
                "<img class='img-responsive' src='" + result.graphs[1][0] + "' />");
            $("#showNumber").addClass("show");
        }
    }

    function apcRateRatiosTab(result) {
        $("#intercept .title, #ftt .title, #fcp .title, #csac .title").text(
            model.titleA + " vs " + model.titleB);

        for (var resultKey in result) {
            var t1 = $("#interceptTable");
            // result has tables, headers and graphs properties
            var headers = [];
            var resultSet = result[resultKey];

            if (resultSet.tables) {
                for (var i = 0; i < resultSet.headers.length; i++) {
                    headers.push({
                        data: resultSet.headers[i].toString(),
                        title: resultSet.headers[i].toString()
                    });
                }

                if ($.fn.DataTable.isDataTable("#" + t1[0].id)) {
                    t1.DataTable().destroy();
                }

                t1.empty().html();

                var dTbl1 = t1.DataTable({
                    "data": resultSet.tables[0],
                    "columns": headers
                });

                dTbl1.draw();
            }
            if (resultSet.graphs) {
                if (resultKey == "FittedTemporalTrends") {
                    $("#fttGraphs").append(
                        "<img class='img-responsive show' src='" +
                        resultSet.graphs[0][0] + "' />");
                } else if (resultKey == "FittedCohortPattern") {
                    $("#fcpGraphs").append(
                        "<img class='img-responsive show' src='" +
                        resultSet.graphs[0][0] + "' />");
                } else if (resultKey == "CrossSectionalAgeCurve") {
                    $("#csacGraphs").append(
                        "<img class='img-responsive show' src='" +
                        resultSet.graphs[0][0] + "' />");
                }
            }
        }
    }

    function apcRateRatioTab(result) {
        for (var resultGroup in result) {
            var resultSet = result[resultGroup];
            if (resultGroup == "CrossSectionalAgeCurve") {
                $("#csac .graphsContainers").append(
                    "<img class='img-responsive show' src='" + resultSet.graphs[0][0] + "' />");
            } else if (resultGroup == "FittedCohortPattern") {
                $("#fcp .graphsContainers").append(
                    "<img class='img-responsive show' src='" + resultSet.graphs[0][0] + "' />");
            } else if (resultGroup == "FittedTemporalTrends") {
                $("#ftt .graphsContainers").append(
                    "<img class='img-responsive show' src='" + resultSet.graphs[0][0] + "' />");
            } else if (resultGroup == "IO") {
                // result has tables, headers
                // and graphs properties
                var t1 = $("#interceptTable");


                $("#intercept .title").html(model.titleA + " vs " + model.titleB);

                if (resultSet.tables[0]) {
                    var headers = [];

                    for (var i = 0; i < resultSet.headers.length; i++) {
                        headers.push({
                            data: resultSet.headers[i].toString(),
                            title: resultSet.headers[i].toString(),
                            className: 'dt-body-right'
                        });
                    }

                    if ($.fn.DataTable.isDataTable("#" + t1[0].id)) t1.DataTable().destroy();
                    t1.empty();

                    var dTbl1 = t1.DataTable({
                        "data": resultSet.tables[0],
                        "columns": headers
                    });


                    dTbl1.draw();
                }

            }

        }
    }

    function previewImage() {
        var img = $(this).find("img")[0];
        $("#imgPreview .modal-body").append("<img class='img-responsive' src='" + img.src + "' />");
    }


    function drop(e) {
        ReadFile.createModel({
            "id": $(e.delegateTarget).attr('data-target'),
            "files": e.originalEvent.dataTransfer.files
        }, updateModel);
    }

    /* ---------- Updates the UI and Model ---------- */
    function update() {
        var self = this;

        // Updates the model based on the contents of the file
        if (self.type == 'file') {
            ReadFile.createModel(self, updateModel);
            var target = $('#inputfile1, #inputfile2');
            target.wrap("<form>").closest("form")[0].reset();
            target.unwrap();
        } else {
            syncModel();
        }
    }

    function reset(e) {
        if (e !== undefined) e.preventDefault();
        $(".graphsContainers").empty();
        $('.output').removeClass('show');

        $('#description,#startAge,#startYear,#interval,#title1,#title2').val("");
        $(".tablesContainers table").each(function () {
            if ($.fn.DataTable.isDataTable(this)) {
                $(this).DataTable().destroy();
            }
            $(this).empty();
            $(".title").empty();
        });
        var matrix = [];
        for (var i = 0; i < 13; i++) {
            var arr = [];
            for (var j = 0; j < 7; j++) {
                arr.push("&zwj;");
            }
            matrix.push(arr);
        }
        createInputTable("#dataset1", createHeaders(3), matrix);
        createInputTable("#dataset2", createHeaders(3), matrix);
        $("#dataset1 .paste-here, #dataset2 .paste-here").remove();
        $("#dataset1 textarea, #dataset2 textarea").before('<img class="img-responsive paste-here" alt="paste here" src="/common/images/paste-here.gif"/>');
    }

    /* ---------- Updates the model with contents from the UI ---------- */
    function syncModel() {
        self.model.description = self.cfg.description.val();
        self.model.startYear = parseFloat(self.cfg.startYear.val());
        self.model.startAge = parseFloat(self.cfg.startAge.val());
        self.model.interval = parseFloat(self.cfg.interval.val());
        self.model.titleA = self.cfg.titleA.val();
        self.model.titleB = self.cfg.titleB.val();
        if (self.model.inputfile1) {
            self.model.inputfile1.title = self.model.titleA;
            table_input($("#dataset1"), self.model.inputfile1);
        }
        if (self.model.inputfile2) {
            self.model.inputfile2.title = self.model.titleB;
            table_input($("#dataset2"), self.model.inputfile2);
        }
    }

    function create_line(line, i) {
        var lead = "&zwj;";
        if (self.model.startAge && self.model.interval) {
            var age = self.model.startAge + (self.model.interval * i);
            lead = age + "-" + (age + self.model.interval - 1);
        }
        line.unshift(lead);
        return line;
    };

    function table_input(target, data) {
        var target = $(target);
        var tableData = $.extend(true, [], data.table);
        if (tableData.length < 1) {
            alert('needs a message 1');
            return;
        }
        var width = tableData[0].length + 1;
        for (var i in tableData) {
            tableData[i] = create_line(tableData[i], i);
            if (tableData[i].length != width) {
                alert('needs a message 2');
                return;
            }
        }
        var table = createInputTable("#" + target.prop("id"), createHeaders((width - 1) / 2, tableData), tableData).children('thead');
        if (self.model.startYear && self.model.interval) {
            var headerRow = $('<tr><th></th></tr>');
            for (var i = 0; i < (width - 1) / 2; i++) {
                var header = self.model.startYear + self.model.interval * i;
                headerRow.append($('<th class="header" colspan="2"></th>').html(header + "-" + (header + self.model.interval - 1)));
            }
            table.prepend(headerRow);
        }
        if (data.title && self.model.description) table.prepend('<tr><th></th><th class="header" colspan="' + (width - 1) + '">' + data.title + '<br/><span class="blue">' + self.model.description + '</span></th></tr>');
        target.children(".paste-here").remove();
    };

    /* ---------- Saves the file contents to the model ---------- */
    function updateModel(id, contents) {
        self.model[id] = contents;

        self.cfg.description.val(self.model[id].description);
        self.cfg.startAge.val(self.model[id].startAge);
        self.cfg.startYear.val(self.model[id].startYear);
        self.cfg.interval.val(self.model[id].interval);

        if (self.model.inputfile1)
            self.cfg.titleA.val(self.model.inputfile1.title);

        if (self.model.inputfile2)
            self.cfg.titleB.val(self.model.inputfile2.title);

        syncModel();
    }

    /* ---------- Saves DOM references in the configuration ---------- */
    function config(cfg) {
        self.cfg = cfg;
        return self.cfg;
    }

    function createHeaders(length, data) {
        var ageHeader = "Age";
        if (data !== undefined) ageHeader = '<span class = "ageGroups">' + data.length + " age groups </span>";
        var headers = [{
            title: ageHeader,
            className: 'dt-center grey'
      }];
        for (var i = 0; i < length; i += 1) {
            headers.push({
                title: "Count",
                className: 'dt-body-right'
            });
            headers.push({
                title: "Population",
                className: 'dt-body-right'
            });
        }
        return headers;
    };

    function createInputTable(containerID, headers, data) {
        var table = $(document.createElement('table'));
        table.attr('class', 'table display compact');
        table.attr('width', '100%');
        $(containerID).children(".dataTables_wrapper").children(".dataTable").DataTable().destroy();
        $(containerID).children("table").remove();
        $(containerID).prepend(table);
        table.DataTable({
            "destroy": true,
            "data": data,
            "columns": headers,
            "bSort": false,
            "bFilter": false,
            "paging": false,
            "responsive": true,
            "dom": 't',
            "scrollX": false
        });
        $(containerID).find('#inputTable_wrapper').addClass('table-responsive');
        $(containerID).find('.table').addClass('input-table');
        return table;
    };
})($, readfile);
